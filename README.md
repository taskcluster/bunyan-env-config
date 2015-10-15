# Taskcluster Logging
We want good logs.  The debug module is great, but it's a little limited for the size of our
current set of taskcluster services.  We've decided to move our components to use something
a little more powerful.  Our choice is to use the bunyan module with a small wrapper.

## Usage
The intention is for each application to only call the function exported by this module once.
In a single js-file library, just do that in your code directly.  In larger applications, the
suggested method is to create a small file (`lib/log.js`) file which sets up the logging
for your whole application.  Since `require()` will cache that module, you'll be sharing
the same root logger in all of your code.

Right now, we're relying on applications to figure out for themselves how they'd like to figure
out what object to pass into logging function.  One idea would be to have a file like:
```javascript
let log = require('taskcluster-lib-logging')({name: 'my-name'});
module.exports = log;
```
And another more complicated idea (TODO: test if this is valid!):
```javascript
let logging = require('taskcluster-lib-logging');
let log;
module.exports = function(cfg) { log = logging(cfg); module.exports = log ; return log };
```
