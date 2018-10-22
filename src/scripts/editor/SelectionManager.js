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

    this.removeDuplicates();
    this.highlightItems();
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
    this.selection = [];
    this.highlightItems();
    this.onSelect.dispatch(this.selection, false);
  }

  triggerSelect() {
    this.onSelect.dispatch(this.selection, false);
  }

  highlightItems() {
    d3.selectAll('.bar--selected').classed('bar--selected', false);
    d3.selectAll('.key--selected').classed('key--selected', false);
    d3.selectAll('.line--selected').classed('line--selected', false);

    // d3.selectAll('.line-label').classed('line-selected', false);
    // d3.select(this).classed('line-selected', true);

    for (var i = 0; i < this.selection.length; i++) {
      var data = this.selection[i];

      if (!data._dom) {
        // (why is this only for `.line-grp` ?)
        var foudnNode = d3.selectAll('.line-grp')[0]
          .find((el) => el.__data__.id === data.id);

        data._dom = foudnNode;
      }

      if (data._dom) {
        var d3item = d3.select(data._dom);

        if (d3item.classed('bar')) {
          d3item.classed('bar--selected', true);
        }
        else if (d3item.classed('key')) {
          d3item.classed('key--selected', true);
        }
        else if (d3item.classed('line-grp')) {
          d3item.classed('line--selected', true);
        }
      }
    }
  }
}
