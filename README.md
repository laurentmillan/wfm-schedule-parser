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

Example of line with all options (timeslots start at 7:00 am, end at 9:00 pm and last 10min)

`node parse -s "7:00 am" -e "9:00 pm" -ts 10`.
