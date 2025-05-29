(function(){
  /* Full shim for Meta-Bind inside static Publish pages */
  function createDummy(){
    class Dummy {}
    Dummy.Plugin = Dummy;           // for require("obsidian/publish").Plugin
    Dummy.injectCss = function(){}; // no-op helpers
    Dummy.events = { on(){}, off(){}, emit(){} };
    return Dummy;
  }

  var dummy = createDummy();
  var module  = { exports: {} };
  var exports = module.exports;
  function require(name){
    if (name && name.startsWith("obsidian")) return dummy;
    return {};
  }

// META-BIND OBSIDIAN PUBLISH SCRIPT
// add this script to the end of you publish.js
// this script loads and executes the latest version of the meta-bind plugin for obsidian publish

// The plugin settings. Not all settings are used.
let mb_settingsString = `{
    "devMode": false,
    "ignoreCodeBlockRestrictions": false,
    "preferredDateFormat": "YYYY-MM-DD",
    "useUsDateInputOrder": false,
    "firstWeekday": {
      "index": 1,
      "name": "Monday",
      "shortName": "Mo"
    },
    "syncInterval": 50,
    "minSyncInterval": 1000,
    "maxSyncInterval": 50,
    "enableJs": true,
    "inputFieldTemplates": [],
    "excludedFolders": [],
    "dateFormat": "eu"
  }`;

// if true, the script is pulled from the master branch instead of the release branch
const mb_dev_mode = false;

const mb_settings = JSON.parse(mb_settingsString);

async function mb_load() {
	const response = mb_dev_mode
		? await fetch('https://raw.githubusercontent.com/mProjectsCode/obsidian-meta-bind-plugin/master/Publish.js')
		: await fetch('https://raw.githubusercontent.com/mProjectsCode/obsidian-meta-bind-plugin/release/Publish.js');
	const script = await response.text();
	eval(script);
}

mb_load();

})();
