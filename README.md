# wfm-schedule-parser
Parse Genesys WFM individual schedule report to extract a CSV file containing generic activities for given timeslots.

# Install
You need NodeJS to run the script.
Go to main directory and run : `npm install`

# Running
Start the command `node parser`.

The repository contains a sample input file named `input.csv`.

Data is extrated in the file named `output.csv`

### Options
Options can be passed as arguments to the command line.
* [`-s` or `-start`] `"[start time]"`
  * `start time` is the start time of timeslots for each day format is h:mm a (ex: "8:00 am")
* [`-e` or `-end`] `"[end time]"`
  * `end time` is the end time of timeslots for each day format is h:mm a (ex: "9:00 pm")
* [`-ts` or `-timeslot`] `timeslot`
  * `timeslot` is the length in minutes of each timeslot (ex: 15 for 15 minutes)
* [`-f` or `-file`] `filename`
  * `filename` is the name of the file used as input (ex: input.csv)
* [`-a` or `-activitymap`] will generate a file that maps all activity specific names (based on parsed file) to a generic name (ex: any specific activity with "Break" will give generic "B"). This file is created as "activity_map.csv".
* [`-use_as` or `-use_activityset`] will use activity set each timesolt where there is no other activity

Example of command lines :
* Timeslots start at 7:00 am, end at 9:00 pm and last 10min. Input file is input_wfm.csv.

`node parse -s "7:00 am" -e "9:00 pm" -ts 10 -f input_wfm.csv`

* Generates the activity map csv file based on input.csv. It will not generate the output.csv

`node parse -f input_wfm.csv -a`

* It will work the same way as the first line except it will place an activity based on the activityset for each timeslot where there is nothing else.

`node parse -s "7:00 am" -e "9:00 pm" -ts 10 -f input_wfm.csv -use_as`


### Activity Map file
This file `activity_map.csv` is a CSV to map specific activity name (like "Break S1") with a generic one that will be used in the final export (output.csv)
The first column is the specific name (ie: "Break S1") and the second is the generic one (ie: "B")

Example of file :

A|B
--|--
Break S1 | B
Break S2 | B
BillingVoice | I
VacationVoice | I
BillingEmail | @

As the parser uses regexp to match an activity name you could get the same result with the following file:

A|B
--|--
Break | B
Voice | I
Email | @
