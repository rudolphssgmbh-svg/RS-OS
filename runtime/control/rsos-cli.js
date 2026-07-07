const supervisor = require("../supervisor/rsos-supervisor");

const cmd = process.argv[2];

if (cmd === "start") supervisor.start(process.argv[3]);
if (cmd === "stop") supervisor.stop();
if (cmd === "status") console.log(supervisor.status());
