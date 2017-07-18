/**
  * Parse Genesys WFM individual schedule report to extract a CSV file containing generic activities for given timeslots.
  *
  * @author Laurent Millan <laurent.millan@genesys.com>
*/

var fs = require("fs")
var csv = require("fast-csv")
var moment = require("moment")
var _ = require("lodash")

var fullData = [];  // The tab containing all teh data for each agent, each day
var lineNbr = 0;
var finalTab;
var activitiesList = [];

/* Create a list of time slots from 8am to 7:30 pm */
var tStart = moment("8:00 am", "h:m a");
var tEnd = moment("7:30 pm", "h:m a");
var t = tStart.clone();
var creneaux = [];
do{
  creneaux.push(t);
  var t = t.clone().add(15, 'minutes')
}while(t.isBefore(tEnd));

/* Read the input CSV file */
fs.createReadStream("input.csv")
.pipe(csv())
.on("data", function(data){
  lineNbr++;

  // Start reading each line starting at line 3
  if(lineNbr>3){
    var site = data[0];         // Site name
    var tz = data[1];           // Timezone
    var equipe = data[2];       // Team
    var id_employe = data[3];   // Employee Id
    var agent = data[4];        // Agent name
    var jour = data[5];         // Day
    var activite = data[7];     // Acivity name
    var starttime = data[8];    // Start time of the activity
    var endtime = data[9];      // End time of the activity

    // If the line contains a data in "jour" > it's the reference line for this date
    if(jour != ""){
      // Create an object containing all the data for this day, for this agent
      var agentDailyData = {
        site: site,
        tz: tz,
        equipe: equipe,
        id_employe: id_employe,
        agent: agent,
        jour: jour,
        activites:[]
      }

      // If this days mentions "Repos", then it's a day off for the agent.
      if(activite.match(/.*Repos.*/gi)){
        // Add the day off as an activity
        agentDailyData.activites.push({
          activite: activite,
          starttime: tStart,
          endtime: tEnd
        });
      }
      // Add this day to the fullData tab
      fullData.push(agentDailyData);
    }
    else{ // If this line doesn't contain a dta in "jour" > it contains an activity for a timeslot in the day.
    // Get the last agent day data
    var agentDailyData = fullData[fullData.length-1];
    // Add a new activity to this agent day activities.
    agentDailyData.activites.push({
      activite: activite,
      starttime: moment(starttime, "h:m a"),
      endtime: moment(endtime, "h:m a")
    });
  }
}
})
.on("end", function(){ // When the reading of the file has ended
  // Split activies accross time slots given at the top
  splitHours();

  // Remove duplicates of the Matching table "activitiesList"
  activitiesList = _.uniqBy(activitiesList, 'default');
  console.log(activitiesList);

  // Aggregate agent's day data tab by day to get a tab matching a day to all agents' data for this day.
  finalTab = aggregatebyDate();

  // Create a csv fiel to push the reults
  var stream = fs.createWriteStream("my_file.csv");
  stream.once('open', function(fd) {
    // Leave 3 cells at the begining of the first row
    var cTab = ["", "", ""];
    // Write all timeslots at the firstline
    creneaux.forEach(function(c){cTab.push(c.format("HH:mm"))});
    stream.write(cTab.join(",") + "\n");

    // For each date
    Object.keys(finalTab).forEach(function(jour){
      // Write the day and line return
      stream.write(jour + "\n");

      // Get all the agents' data for this day
      jour = finalTab[jour];
      jour.forEach(function(agentDayData){
        // Tab containing each cell of this line
        var lineData = [];
        // Add the first name of the agent
        lineData.push(agentDayData.agent.split(" ")[0]);
        // Add the last name of the agent
        lineData.push(agentDayData.agent.split(" ")[1]);
        // Add the site of this agent
        lineData.push(agentDayData.site);
        // For each timeslot activity of this agent, add the generic activity name to the line
        agentDayData.finalActivities.forEach(function(activity){
          lineData.push(activity.activite);
        })
        // Write the line
        stream.write(lineData.join(",") + "\n");
      });
      // Write a line return after the last elemnt for this day.
      stream.write("\n");
    })
    stream.end();
  });
});

/*
  Determines if the activity has time in the given timeslot
  If the activity starts at the same time as the timeslot > TRUE
  If the activity starts before the timeslot and ends after the timeslot > TRUE
  Otherwise > FALSE
*/
var getTimeInCreneau = function(activite, creneau){
  if(activite.starttime.isSame(creneau)){
    return true;
  }else if(activite.starttime.isBefore(creneau) &&
            activite.endtime.isAfter(creneau))
    return true;
}

// Split activities accross timeslots
var splitHours = function(){
  // For each element in the full data tab
  fullData.forEach(function(data){
    // Create a new tab named finalActivities
    data.finalActivities = [];
    // For each time slot defined at the top
    creneaux.forEach(function(creneau){
      var creneauActivite = {
        creneau: creneau,
        activite: ""
      }
      // Find the activity for this timeslot based on the list of activities for this agent & day
      data.activites.forEach(function(activite){
        // If the activity has time in this time slot
        if(getTimeInCreneau(activite, creneau)){
          // Translate from the specific activity to a generic one
          creneauActivite.activite = translateActivite(activite.activite)
          // Fill the matching table between specific activity name to generic/translated one.
          activitiesList.push({default: activite.activite, translated: creneauActivite.activite });
        }
      });
      // Add this data matchoing a timeslot with a generic activity name to the finalActivities tab of this agent & day data.
      data.finalActivities.push(creneauActivite);
    })
  })
}

// Matches a specific activity name to a generic one based on what the specific activity name contains.
var translateActivite = function(activite){
  if(activite.match(/.*Entrant.*/)){
    return "AE"; // Inbound
  }else if (activite.match(/.*Sortant.*/gi)){
    return "AS"; // Outbound
  }else if (activite.match(/.*Email.*/gi)){
    return "@"; // Email
  }else if (activite.match(/.*Chat.*/gi)){
    return "C"; // Chat
  }else if (activite.match(/.*Repas.*/gi)){
    return "R"; // Lunch
  }else if (activite.match(/.*repos.*/gi)){
    return "JR"; // Day off
  }else if (activite.match(/.*Pause.*/gi)){
    return "P";  // Pause
  }
}

/*
  Aggregate data by date to have a table containing for each day all the agent's day data.
*/
var aggregatebyDate = function(){
  // The final tab
  var finalDataPresentation = [];

  // Run through all the agent's single day data from fullData tab.
  fullData.forEach(function(data){
    if(!finalDataPresentation[data.jour])
      finalDataPresentation[data.jour] = [];

    finalDataPresentation[data.jour].push(data);
  });

  return finalDataPresentation;
}
