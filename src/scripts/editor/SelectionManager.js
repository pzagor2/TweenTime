let d3 = require('d3');
let Signals = require('js-signals');
let _ = require('lodash');

export default class SelectionManager {
  constructor(tweenTime) {
    this.tweenTime = tweenTime;
    this.selection = [];
    this.onSelect = new Signals.Signal();
  }

  addOnSelectListener(listener) {
    this.onSelect.add(listener);
  }

  removeOnSelectListener(listener) {
    this.onSelect.remove(listener);
  }

  select(item, addToSelection = false) {
    if (!addToSelection) {
      this.selection.forEach((item) => item.selected = false);
      this.selection = [];
    }
    if (item instanceof Array) {
      for (var i = 0; i < item.length; i++) {
        var el = item[i];
        this.selection.push(el);
      }
    }
    else {
      this.selection.push(item);
    }

    this.selection.forEach((item) => item.selected = true);
    this.removeDuplicates();
    this.sortSelection();
    this.onSelect.dispatch(this.selection, addToSelection);
  }

  getSelection(options) {
    options = options || {};

    if (options.type === 'key') {
      // it might be better to contain item type
      return this.selection.filter((item) => item.ease);
    }

    return this.selection;
  }

  removeDuplicates() {
    var result = [];
    for (var i = 0; i < this.selection.length; i++) {
      var item = this.selection[i];
      var found = false;
      for (var j = 0; j < result.length; j++) {
        var item2 = result[j];
        if (_.isEqual(item, item2)) {
          found = true;
          break;
        }
      }
      if (found === false) {
        result.push(item);
      }
    }
    this.selection = result;
  }

  removeItem(item) {
    // If we pass an _id then search for the item and remove it.
    if (typeof item === 'string') {
      let itemObj = _.find(this.selection, function(el) {
        return el._id === item;
      });
      if (itemObj) {
        return this.removeItem(itemObj);
      }
    }

    // Remove the object if it exists in the selection.
    var index = this.selection.indexOf(item);
    if (index > -1) {
      this.selection.splice(index, 1);
    }
    this.triggerSelect();
  }

  sortSelection() {
    var compare = function(a, b) {
      if (!a.time || !b.time) {
        return 0;
      }
      if (a.time < b.time) {
        return -1;
      }
      if (a.time > b.time) {
        return 1;
      }
      return 0;
    };
    this.selection = this.selection.sort(compare);
  }

  reset() {
    this.selection.forEach((item) => item.selected = false);
    this.selection = [];
    this.onSelect.dispatch(this.selection, false);
  }

  triggerSelect() {
    this.onSelect.dispatch(this.selection, false);
  }
}
