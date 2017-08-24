const chalk = require('chalk');

class Log {

  constructor() {
    this.chalk = chalk;
  }

  alert(str) {
    console.log(chalk.red.inverse(str));
  }

  default(str) {
    console.log(chalk.inverse(str));
  }

  info(str) {
    console.log(chalk.rgb(130, 175, 20).inverse(str));
  }
}

module.exports = new Log();