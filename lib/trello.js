class Trello {

  constructor(appKey, userToken) {
    let Trello = require('trello');
    this.trello = new Trello(appKey, userToken);
  }

  getUser() {
    return this.trello.makeRequest('get', `/1/members/me`, {fields: 'id,username'});
  }

  getUserBoards() {
    return new Promise((resolve, reject) => {
      this.trello.makeRequest('get', `/1/members/me/boards`, {fields: 'id,name'}).then(res => {
        resolve(res.map(board => {
          return {name: board.name, value: board.id};
        }));
      });
    });
  }

  getBoardMembers(id) {
    return this.trello.makeRequest('get', `/1/boards/${id}/members`, {fields: 'id,username'});
  }

  getMember(idOrUsername) {
    return this.trello.makeRequest('get', `/1/members/${idOrUsername}`, {fields: 'id,username'});
  }

  getLists(id) {
    return new Promise((resolve, reject) => {
      this.trello.makeRequest('get', `/1/boards/${id}/lists`, {fields: 'id,name'}).then(res => {
        resolve(res.map(list => {
          return {name: list.name, value: list.id};
        }));
      });
    });
  }

  getBoardLabels(id) {
    return new Promise((resolve, reject) => {
      this.trello.makeRequest('get', `/1/boards/${id}/labels`, {fields: 'id,name'}).then(res => {
        resolve(res.map(label => {
          return {name: label.name, value: label.id};
        }));
      });
    });
  }

  getListCards(id) {
    return new Promise((resolve, reject) => {
      this.trello.makeRequest('get', `/1/lists/${id}/cards`, {fields: 'name,id'}).then(res => {
        resolve(res.map(card => {
          return {name: card.name, value: card.id};
        }));
      });
    });
  }

  getCardChecklists(id) {
    return new Promise((resolve, reject) => {
      this.trello.makeRequest('get', `/1/cards/${id}/checklists`, {fields: 'id,name'}).then(res => {
        resolve(res.map(checklist => {
          return {name: checklist.name, value: checklist.id};
        }));
      });
    });
  }

  getChecklist(id) {
    return this.trello.makeRequest('get', `/1/checklists/${id}`, {fields: 'id,name,checkItems'});
  }

  deleteCheckItem(idChecklist, idCheckItem) {
    return this.trello.makeRequest('delete', `/1/checklists/${idChecklist}/checkItems/${idCheckItem}`);
  }

  addCheckItem(id, name, position) {
    return this.trello.makeRequest('post', `/1/checklists/${id}/checkItems`, {name: name, pos: position || 'bottom'});
  }

  copyCard(idList, idCardSource, name, desc, assignLabels, assignMembers) {
    return new Promise((resolve, reject) => {
      this.trello.makeRequest('post', `/1/cards/`, {
        idList: idList,
        idCardSource: idCardSource,
        keepFromSource: 'checklists',
        name: name,
        desc: desc,
        idLabels: assignLabels.join(',') || [],
        idMembers: assignMembers.join(',') || []
      }).then(res => {
        resolve(res);
      });
    });
  }
}

module.exports = Trello;