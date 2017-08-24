#! /usr/bin/env node

require('dotenv').config();

const fs = require('fs');
const fuzzy = require('fuzzy');
const inquirer = require('inquirer');
const log = require('../lib/log');
const {table} = require('table');

const Trello = require('../lib/trello');
const trello = new Trello(process.env.TRELLO_APP_KEY, process.env.TRELLO_USER_TOKEN);

// Register autocomplete prompt type
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

class Command {

  constructor () {

    // Current user
    this.user = null;
    // Members of this board
    this.members = {};
    // Regex pattern used to identify tasks
    this.searchPattern = null;
    // Collection of milestones, tasks, and estimates
    this.estimate = {};
    // RegEx to find tasks in checklist items
    this.searchPattern = new RegExp('\\((@[a-zA-Z0-9]+/?)+\\)( - [0-9]+/[0-9]+)?$');

    trello.getUser().then(user => {
      this.user = user;
      return inquirer.prompt([
        {
          name: 'dryRun',
          type: 'confirm',
          message: 'Dry run?',
          default: true,
          validate: () => {
            if (answers.dryRun) {
              log.info('This is a dry-run. No data will change.');
            } else {
              log.alert('THIS IS NOT A DRY-RUN.');
            }
            return true;
          }
        },
        {
          name: 'boardId',
          type: 'autocomplete',
          message: () => {
            log.default('STEP 1: Tell us about your Trello setup');
            return 'Which of your boards are we working on?';
          },
          source: (answersSoFar, input) => {
            return this.autocompleteSearch(input, trello.getUserBoards());
          }
        },
        {
          name: 'templateCardListId',
          type: 'autocomplete',
          message: 'Which list has your template card?',
          source: (answersSoFar, input) => {
            // Now that we have the boardId from the previous question...
            this.getListsPromise = trello.getLists(answersSoFar.boardId);
            return new Promise((resolve, reject) => {
              trello.getBoardMembers(answersSoFar.boardId).then(members => {
                members.forEach(member => {
                  this.members[`@${member.username}`] = member.id;
                });
                return this.autocompleteSearch(input, this.getListsPromise);
              }).then(result => resolve(result));
            });
          }
        },
        {
          name: 'templateCardId',
          type: 'autocomplete',
          message: 'Which card is your template?',
          source: (answersSoFar, input) => {
            return this.autocompleteSearch(input, trello.getListCards(answersSoFar.templateCardListId));
          }
        },
        {
          name: 'milestonesListId',
          type: 'autocomplete',
          message: 'Which list has your milestones?',
          source: (answersSoFar, input) => {
            return this.autocompleteSearch(input, this.getListsPromise);
          }
        },
        {
          name: 'destinationListId',
          type: 'autocomplete',
          message: () => {
            log.default('Step 2: Configure how we handle the new cards');
            return 'Which list should the new cards be creating in?';
          },
          source: (answersSoFar, input) => {
            return this.autocompleteSearch(input, this.getListsPromise);
          }
        },
        {
          name: 'labelIds',
          type: 'checkbox',
          message: 'Which labels do you want applied to the new cards?',
          choices: (answersSoFar) => {
            return trello.getBoardLabels(answersSoFar.boardId);
          }
        },
        {
          name: 'assignUser',
          type: 'confirm',
          message: 'Add the user(s) assigned to a task to the new cards?',
          default: true
        },
        {
          name: 'restrictToUser',
          type: 'confirm',
          message: () => {
            log.default('Step 3: Configure which tasks we should process');
            return `Only process your own tasks (assigned to @${this.user.username})?`;
          },
          default: true
        },
        {
          name: 'restrictToEstimated',
          type: 'confirm',
          message: `Only process estimated tasks?`,
          default: true
        }
      ]);
    }).then(answers => {

      // this.searchPattern = new RegExp(
      //   (answers.restrictToUser ? `\\(@${this.user.username}\\)` : '\\(@[a-Z0-9]+\\)') +
      //   (answers.restrictToEstimated ? ' - [0-9]+/[0-9]+$' : '( - [0-9]+/[0-9]+)?$')
      // );

      // Get milestone cards
      trello.getListCards(answers.milestonesListId).then(cards => {
        let resolve = Promise.resolve();
        cards.forEach(card => {
          resolve = resolve.then(() => {
            log.info(`Processing milestone: ${card.name}`);
            this.estimate[card.value] = {
              name: card.name,
              tasks: []
            };
            // Ask for tasks checklist
            return inquirer.prompt([{
              name: 'tasksChecklistId',
              type: 'list',
              message: 'Which checklist has your tasks?',
              choices: () => trello.getCardChecklists(card.value)
            }]);
          }).then(answers => {
            return trello.getChecklist(answers.tasksChecklistId);
          }).then(checklist => {
            let tasks = [];
            checklist.checkItems.forEach(item => {
              // Check the checklist item name to see if it matches our template
              let match = item.name.match(this.searchPattern);
              if (match) {
                // Get the assignee(s)
                let assignees = match[0].match(new RegExp('^\\((@[a-zA-Z0-9]+/?)+\\)'));
                assignees = assignees[0];
                assignees = assignees.substr(1, assignees.length - 2);
                assignees = assignees.split('/');
                if (!answers.restrictToUser || assignees.indexOf(`@${this.user.username}`) !== -1) {
                  let estimatedHours = match[0].match(new RegExp('[0-9]+/[0-9]+$'));
                  let hasEstimate = !!estimatedHours;
                  if (!answers.restrictToEstimated || hasEstimate) {
                    // New card estimate
                    let [low, high] = hasEstimate ? estimatedHours[0].split('/') : [0, 0];
                    // New card name
                    let name = item.name.replace(this.searchPattern, '').trim();
                    tasks.push({
                      name: hasEstimate ? `${name} (${low}/${high})` : name,
                      value: {
                        name: name,
                        hasEstimate: hasEstimate,
                        low: low,
                        high: high,
                        assignees: assignees,
                        checklistId: checklist.id,
                        checkItem: item
                      }
                    });
                  }
                }
              }
            });
            if (tasks.length < 1) {
              log.default('No tasks matched the search pattern.');
            } else {
              return inquirer.prompt([{
                name: 'approvedTasks',
                type: 'checkbox',
                message: 'Select which tasks you would like converted to cards:',
                choices: tasks
              }]).then(res => {
                let resolve = Promise.resolve();
                res.approvedTasks.forEach(task => {
                  this.estimate[card.value].tasks.push({
                    name: task.name,
                    low: task.low,
                    high: task.high,
                    assignees: task.assignees
                  });
                  let assigneeIds = task.assignees
                    .filter(assignee => this.members[assignee])
                    .map(assignee => this.members[assignee]);
                  if (!answers.dryRun) {
                    resolve = resolve.then(() => {
                      return trello.copyCard(
                        // The list the new card will be saved to
                        answers.destinationListId,
                        // Card we're copying
                        answers.templateCardId,
                        // New card's name
                        task.name,
                        // New card's description
                        task.hasEstimate ? `${task.low}\n${task.high}` : '',
                        // New card's labels
                        answers.labelIds,
                        // New card's members
                        answers.assignUser ? assigneeIds : []
                      );
                    }).then((card) => {
                      return Promise.all([
                        // Delete the task we just processed
                        trello.deleteCheckItem(task.checkItem.idChecklist, task.checkItem.id),
                        card
                      ]);
                    }).then(([result, card]) => {
                      return trello.addCheckItem(task.checklistId, card.shortUrl, task.checkItem.pos);
                    });
                  }
                });
                return resolve;
              });
            }
          });
        });
        return resolve;
      }).then(() => {
          var data = [
            ['Task', 'Assignees', 'Low', 'High']
          ];
          let totals = {low: 0, high: 0};
          Object.keys(this.estimate).forEach(id => {
            if (this.estimate[id].tasks.length > 0) {
              // data.push([log.chalk.bold(this.estimate[id].name), '', '', '']);
              data.push([this.estimate[id].name, '', '', '']);
              this.estimate[id].tasks.forEach(task => {
                if (task.low + task.high > 0) {
                  data.push([task.name, task.assignees.join(', '), task.low, task.high]);
                } else {
                  data.push([task.name, task.assignees.join(', '), '', '']);
                }
                totals.low += parseInt(task.low, 10);
                totals.high += parseInt(task.high, 10);
              });
            }
          });
          // data.push([
          //   log.chalk.bold('TOTALS'),
          //   '',
          //   log.chalk.bold(totals.low),
          //   log.chalk.bold(totals.high)
          // ]);
          data.push([
            'TOTALS',
            '',
            totals.low,
            totals.high
          ]);
          if (answers.restrictToUser) {
            data = data.map(row => {
              return [
                row[0],
                row[2],
                row[3]
              ];
            });
          }
          inquirer.prompt([
            {
              name: 'displayTable',
              type: 'confirm',
              message: 'Display estimate table?',
              default: true
            },
            {
              name: 'csv',
              type: 'confirm',
              message: 'Save estimate to CSV?',
              default: true
            }
          ]).then(answers => {
            if (answers.displayTable) {
              console.log(table(data));
            }
            if (answers.csv) {
              this.saveCsv(data);
            }
          });
        });
    });
  }

  autocompleteSearch(query, dataPromise) {
    return new Promise((resolve, reject) => {
      dataPromise.then((data) => {
        let matches = fuzzy.filter(query, data, {
          extract: (item) => {
            return item.name;
          }
        });
        if (query !== null) {
          resolve(matches.map(match => match.original));
        } else {
          resolve(matches);
        }
      });
    });
  }

  saveCsv(data) {
    let str = '';
    data.forEach(row => {
      str += row.map(col => `"${col}"`).join(',') + '\n';
    });
    fs.writeFileSync('estimate.csv', str);
  }
}

new Command();