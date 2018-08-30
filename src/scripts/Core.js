var _ = require('lodash');

import Utils from './core/Utils';
import Timer from './core/Timer';
import Orchestrator from './core/Orchestrator';

class Core {
  constructor(data, options = {}) {
    this.data = data;
    this.options = options;
    this.timer = new Timer(options);
    this.orchestrator = new Orchestrator(this.timer, this.data);
    this.onDataUpdated();
    this.orchestrator.addUpdateListener(this.onDataUpdated.bind(this));
  }

  // Timer listeners
  addTimerUpdateListener(listener) {
    this.timer.addUpdateListener(listener);
  }
  removeTimerUpdateListener(listener) {
    this.timer.removeUpdateListener(listener);
  }

  addTimerStatusChangedListener(listener) {
    this.timer.addStatusChangedListener(listener);
  }
  removeTimerStatusChangedListener(listener) {
    this.timer.removeStatusChangedListener(listener);
  }

  addTimerDurationChangedListener(listener) {
    this.timer.addDurationChangedListener(listener);
  }
  removeTimerDurationChangedListener(listener) {
    this.timer.removeDurationChangedListener(listener);
  }

  onDataUpdated() {
    // find last key in this.data
    var lastKeyTime = 0;
    for (var el of this.data) {
      for (var prop of el.properties) {
        lastKeyTime = prop.keys.reduce((max, key) => {
          return Math.max(max, key.time);
        }, lastKeyTime);
      }
    }
    this.timer.setEndKeyTime(lastKeyTime);
  }


  // Orchestrator listeners
  addUpdateListener(listener) {
    this.orchestrator.addUpdateListener(listener);
  }

  removeUpdateListener(listener) {
    this.orchestrator.removeUpdateListener(listener);
  }

  tirggerUpdateListener() {
    this.orchestrator.tirggerUpdateListener();
  }

  setData(data) {
    this.data = data;
    this.orchestrator.setData(data);
  }

  getData() {
    return this.data;
  }

  getItem(item_id) {
    // In case we passed the item object directly return it.
    if (item_id && typeof item_id === 'object') {
      return item_id;
    }

    return _.find(this.data, (item) => item.id === item_id);
  }

  getCurrentTime() {
    return this.timer.getCurrentTime();
  }

  getTimerDuration() {
    return this.timer.getDuration();
  }

  getProperty(prop_name, item_id_or_obj) {
    // If we passed the item name get the object from it.
    let item = this.getItem(item_id_or_obj);

    // Return false if we have no item
    if (!item) {
      return false;
    }

    return _.find(item.properties, property => property.name === prop_name);
  }

  getValues(item_id_or_obj) {
    // If we passed the item name get the object from it.
    let item = this.getItem(item_id_or_obj);

    // Return false if we have no item
    if (!item) {
      return undefined;
    }
    if (!item.values) {
      this.orchestrator.initItemValues(item);
    }
    return item.values;
  }

  getValue(prop_name, item_id_or_obj) {
    // If we passed the item name get the object from it.
    var values = this.getValues(item_id_or_obj);

    // Return false if we have no item
    if (!values) {
      return undefined;
    }

    if (values[prop_name] !== undefined) {
      return values[prop_name];
    }
    return undefined;
  }

  getKeyAt(property, time_in_seconds) {
    return this.orchestrator.getKeyAt(property, time_in_seconds);
  }

  getKeyWithId(property, keyId) {
    return this.orchestrator.getKeyWithId(property, keyId);
  }

  getPrecedingKey(property, time) {
    var key;
    if (property.keys.length === 1) {
      key = property.keys[0];
    }
    else {
      key = _.findLast(property.keys, function(k) {
        return time > k.time;
      });
    }

    return key;
  }

  getKeyById(property, keyId) {
    return _.find(property.keys, key => key._id === keyId);
  }

  setValue(property, new_val, time_in_seconds = false) {
    let time = time_in_seconds;
    if (time === false) {
      time = this.timer.getCurrentTime() / 1000;
    }
    var key = this.getKeyAt(property, time);

    if (key) {
      // If we found a key, simply update the value.
      key.value = new_val;
    }
    else {
      // If we are not on a key but the property has other keys,
      // create it and add it to the keys array.
      key = {value: new_val, time: time, _property: property};
      if (this.options.defaultEase) {
        key.ease = this.options.defaultEase;
      }
      property.keys.push(key);
    }

    // Also sort the keys.
    property.keys = Utils.sortKeys(property.keys);
  }

  setKeyData(property, key_id, value, time, easing) {
    // find old key by id
    var key = this.getKeyById(property, key_id);
    if (key) {
      if (value !== undefined || value !== null) {
        key.value = value;
      }
      if (time !== undefined || time !== null) {
        key.time = time;
      }
      if (easing) {
        key.ease = easing;
      }
    }
    else {
      // Create new key
      setValueEase(property, value, easing, time);
    }
  }

  mergeItem(elementId) {
    var item = this.getItem(elementId);
    this.orchestrator.mergeProperty(item);
  }

  setValueEase(property, new_val, new_easing, time_in_seconds = false, new_unit) {
    let time = time_in_seconds;
    if (time === false) {
      time = this.timer.getCurrentTime() / 1000;
      // time = Utils.roundTimeFloat(time);
    }
    var key = this.getKeyAt(property, time);

    if (key) {
      // If we found a key, simply update the value.
      key.value = new_val;
      if (new_easing) {
        key.ease = new_easing;
      }
      if (new_unit) {
        key.unit = new_unit;
      }
    }
    else {
      // If we are not on a key but the property has other keys,
      // create it and add it to the keys array.
      key = {value: new_val, time: time, _property: property};
      if (new_unit) {
        key.unit = new_unit;
      }
      if (this.options.defaultEase) {
        key.ease = this.options.defaultEase;
      }
      if (new_easing) {
        key.ease = new_easing;
      }
      property.keys.push(key);
    }

    // Also sort the keys.
    property.keys = Utils.sortKeys(property.keys);
  }

  getTotalDuration() {
    return this.orchestrator.getTotalDuration();
  }

  addOnEventListener(callback) {
    this.orchestrator.onEvent.add(callback);
  }

  removeOnEventListener(callback) {
    this.orchestrator.onEvent.remove(callback);
  }
}

module.exports = Core;
