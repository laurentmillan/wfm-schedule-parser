# wfm-schedule-parser
Parse Genesys WFM individual schedule report to extract a CSV file containing generic activities for given timeslots.

# Install
You need NodeJS to run the script.
Go to main directory and run : `npm install`

# Running
Start the command `node parser`
The repository contains a sample input file named `input.csv`.
Data is extrated in the file named `output.csv`

# Configure
You can change when the timeslots start (8:00 am by default): `var tStart = moment("8:00 am", "h:m a");` @ line 18
When they end (7:30 pm by default): `var tEnd = moment("7:30 pm", "h:m a");` @ line 19

You can also change how much timeslot span (15min by default): `var t = t.clone().add(15, 'minutes')` @ line 24
