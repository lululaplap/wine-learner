// Where each sheet is read from. build.sh swaps these local copies for the published Google Sheets links;
// a sheet with no link set in build.sh keeps reading its copy in sheets/.
export const SHEETS = {
  wine: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSH5PMPgMOSJTzJ3FnKJmZxY3lI0loTNugZsmD6_U7PeT4LHiYJY75BtW-mFIgpeVbuDoZ8x724M6i1/pub?gid=652214147&single=true&output=csv",
  study: "sheets/study.csv",
  lists: "sheets/lists.csv"
};

// The copy in sheets/, used for local testing (add ?local to the address) and as a last resort
// when a sheet cannot be loaded and this device has no saved copy yet.
export const localCopy = name => "sheets/" + name + ".csv";
