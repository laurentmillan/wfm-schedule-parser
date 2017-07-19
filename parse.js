/**
  * Parse Genesys WFM individual schedule report to extract a CSV file containing generic activities for given timeslots.
  *
  * @author Laurent Millan <laurent.millan@genesys.com>
  *
  * Options
  *   > -h, -help, --h, --help => Show help
  *   > -start, -s => start time for timeslots
  *   > -end, -e => end time for timeslots
  *   > -ts, -timeslot => duration of timeslots
  *   > -f, -file => input file name
  *   > -a, -activtymap => will generate the specific/geenric activities names map csv file
*/

var fs = require("fs")
var csv = require("fast-csv")
var moment = require("moment")
var _ = require("lodash")

var agentDayActivityTab = [];  // The tab containing all teh data for each agent, each day
var lineNbr = 0;
var finalTab;
var activitiesList = [];
var activityMap = [];
var inputFilename = "input.csv";

var tStart = moment("8:00 am", "h:m a");  // Start of the day for timeslots
var tEnd = moment("7:30 pm", "h:m a");    // End of the day for timeslots
var tTimeslotLength = 15;                 // Timeslots length

var RUNMODE = {
  PARSE: 'parse',             // Will generate the output files
  HELP: 'help',               // Will only display help
  ACTIVITYMAP: 'activitymap'  // Will generate a file containing a map for specific activity names / generic activity names
}
var runMode = RUNMODE.PARSE;
process.argv.forEach(function (val, index, array) {
  if(index > 1){
    switch(val){
      case '-h':
      case '-help':
      case '--h':
      case '--help':
        runMode = RUNMODE.HELP;
        break;
      case '-s':
      case '-start':
        tStart = moment(process.argv[index+1], "h:m a");
        break;
      case '-e':
      case '-end':
        tEnd = moment(process.argv[index+1], "h:m a");
        break;
      case '-ts':
      case '-timeslot':
        tTimeslotLength = process.argv[index+1];
        break;
      case '-f':
      case '-file':
        inputFilename = process.argv[index+1];
        break;
      case '-a':
      case '-activitymap':
        runMode = RUNMODE.ACTIVITYMAP;
        break;
      default:
        break;
    }
  }
});

switch(runMode){
  case RUNMODE.ACTIVITYMAP:
    parse();
    break;
  case RUNMODE.PARSE:
    parse();
    break;
  default:
    showHelp();
    break;
}

function showHelp(){
  console.log('********************************************\n\
  Options \n\
  *   > -h, -help, --h, --help => Show help \n\
  *   > -start, -s "8:00 am" => start time for timeslots \n\
  *   > -end, -e  "7:30 pm" => end time for timeslots \n\
  *   > -ts, -timeslot 15 => duration of timeslots (15 minutes)\n \
  *   > -f, -file input.csv => input file name\n\
  *   > -a, -activitymap => will generate the specific/geenric activities names map csv file \n\
  *   > -use_as, -use_activityset => will use activity set each timesolt where there is no other activity \n\
  ********************************************\n');
}

function parse(){
  // Display paramters
  console.log("********************************************")
  console.log("Parameters: \n \
    \t start: "+tStart.format("h:mm a")+"\n\
    \t end: "+tEnd.format("h:mm a")+"\n\
    \t timeslot: "+tTimeslotLength+" minutes\n\
    \t inputfile: "+inputFilename+" \n");
    console.log("********************************************\n")

  /* Create a list of time slots from 8am to 7:30 pm */
  var t = tStart.clone();
  var timeslots = [];
  do{
    timeslots.push(t);
    var t = t.clone().add(tTimeslotLength, 'minutes')
  }while(t.isBefore(tEnd));

  /* Read activities mapping tab */
  fs.createReadStream("activity_map.csv")
  .pipe(csv())
  .on("data", function(data){
    activityMap.push({ specificName : data[0], genericName: data[1]});
  })
  .on("end", function(){
    readAndParseInputFile();
  });

  var readAndParseInputFile = function(){
    /* Read the input CSV file */
    fs.createReadStream(inputFilename)
    .pipe(csv())
    .on("data", function(data){
      lineNbr++;

      // Start reading each line starting at line 3
      if(lineNbr>3){
        var site = data[0];         // Site name
        var tz = data[1];           // Timezone
        var team = data[2];       // Team
        var employeeId = data[3];   // Employee Id
        var agentName = data[4];        // Agent name
        var date = data[5];         // Day
        var activityName = data[7];     // Acivity name
        var starttime = data[8];    // Start time of the activity
        var endtime = data[9];      // End time of the activity

        // If the line contains a data in "date" > it's the reference line for this date
        if(date != ""){
          // Create an object containing all the data for this day, for this agent
          var agentDailyData = {
            site: site,
            tz: tz,
            team: team,
            employeeId: employeeId,
            agentName: agentName,
            date: date,
            activitySet: {
              activityName: activityName,
              starttime: (starttime!="")?moment(starttime, "h:m a"):moment(tStart, "h:m a"), // if there is no time, put tStart
              endtime: (endtime!="")?moment(endtime, "h:m a"):moment(tEnd, "h:m a") // if there is no time, put tEnd
            },
            activities:[]
          }


          // Add this day to the agentDayActivityTab tab
          agentDayActivityTab.push(agentDailyData);
        }
        else{ // If this line doesn't contain a dta in "date" > it contains an activity for a timeslot in the day.
          // Get the last agent day data
          var agentDailyData = agentDayActivityTab[agentDayActivityTab.length-1];
          // Add a new activity to this agent day activities.
          agentDailyData.activities.push({
            activityName: activityName,
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
      activitiesList = _.uniqBy(activitiesList, 'specificName');
      console.log(activitiesList);

      // In this mode we want to generate a tab to match specific and generic activities names
      if(runMode == RUNMODE.ACTIVITYMAP){
        // Create a csv file to create a tab matching specific activities names and generic name
        var stream = fs.createWriteStream("activity_map.csv");
        stream.once('open', function(fd) {
          activitiesList.forEach(function(activity){
            stream.write(activity.specificName + "," + activity.genericName + "\n");
          })
          stream.end();
        });
      }

      // In this mode we want to export the output file.
      if(runMode == RUNMODE.PARSE){
        // Aggregate agent's day data tab by day to get a tab matching a day to all agents' data for this day.
        finalTab = aggregatebyDate();

        // Create a csv fiel to push the reults
        var stream = fs.createWriteStream("output.csv");
        stream.once('open', function(fd) {
          // Leave 3 cells at the begining of the first row
          var cTab = ["", "", "", ""];
          // Write all timeslots at the firstline
          timeslots.forEach(function(c){cTab.push(c.format("HH:mm"))});
          stream.write(cTab.join(",") + "\n");

          // For each date
          Object.keys(finalTab).forEach(function(date){
            // Write the day and line return
            stream.write(date + "\n");

            // Get all the agents' data for this day
            date = finalTab[date];
            date.forEach(function(agentDayData){
              // Tab containing each cell of this line
              var lineData = [];
              // Add the first name of the agent
              lineData.push(agentDayData.agentName.split(" ")[0]);
              // Add the last name of the agent
              lineData.push(agentDayData.agentName.split(" ")[1]);
              // Add the site of this agent
              lineData.push(agentDayData.site);
              // For each timeslot activity of this agent, add the generic activity name to the line
              agentDayData.timeslotActivities.forEach(function(activity){
                lineData.push(activity.activityName);
              })
              // Write the line
              stream.write(lineData.join(",") + "\n");
            });
            // Write a line return after the last elemnt for this day.
            stream.write("\n");
          })
          stream.end();
        });
      }
    });

  }

  /*
    Determines if the activity has time in the given timeslot
    If the activity starts at the same time as the timeslot > TRUE
    If the activity starts before the timeslot and ends after the timeslot > TRUE
    Otherwise > FALSE
  */
  var getActivityTimeInTimeslot = function(activity, timeslot){
    if(activity.starttime.isSame(timeslot)){
      return true;
    }else if(activity.starttime.isBefore(timeslot) &&
              activity.endtime.isAfter(timeslot))
      return true;
  }

  // Split activities accross timeslots
  var splitHours = function(){
    // For each element in the full data tab
    agentDayActivityTab.forEach(function(data){
      // Create a new tab named timeslotActivities
      data.timeslotActivities = [];
      // For each time slot defined at the top
      timeslots.forEach(function(timeslot){
        // Create a timeslot activity definition
        var timeslotActivity = {
          timeslot: timeslot,
          activityName: ""
        }
        // Find the activity for this timeslot based on the list of activities for this agent & day
        var foundActivity = false;
        data.activities.forEach(function(activity){
          // If the activity has time in this time slot
          if(getActivityTimeInTimeslot(activity, timeslot)){
            foundActivity = true;
            // Translate from the specific activity to a generic one
            timeslotActivity.activityName = getGenericActivityName(activity.activityName)
            // Fill the matching table between specific activity name to specificName/genericName one.
            activitiesList.push({specificName: activity.activityName, genericName: timeslotActivity.activityName });
          }
        });

        if(!foundActivity){
          // If the activity has time in this time slot
          if(getActivityTimeInTimeslot(data.activitySet, timeslot)){
            // Translate from the specific activity to a generic one
            timeslotActivity.activityName = getGenericActivityName(data.activitySet.activityName)
            // Fill the matching table between specific activity name to specificName/genericName one.
            activitiesList.push({specificName: data.activitySet.activityName, genericName: timeslotActivity.activityName });
          }
        }

        // Add this data matchoing a timeslot with a generic activity name to the timeslotActivities tab of this agent & day data.
        data.timeslotActivities.push(timeslotActivity);
      })
    })
  }

  // Matches a specific activity name to a generic one based on what the specific activity name contains.
  var getGenericActivityName = function(specificActivityName){
    var found = activityMap.find(function(activity){
      return (specificActivityName.match(new RegExp(activity.specificName)) != null);
    });
    if(found)
      return found.genericName;
    else
      return "";
  }

  /*
    Aggregate data by date to have a table containing for each day all the agent's day data.
  */
  var aggregatebyDate = function(){
    // The final tab
    var finalDataPresentation = [];

    // Run through all the agent's single day data from agentDayActivityTab tab.
    agentDayActivityTab.forEach(function(data){
      if(!finalDataPresentation[data.date])
        finalDataPresentation[data.date] = [];

      finalDataPresentation[data.date].push(data);
    });

    return finalDataPresentation;
  }

}
