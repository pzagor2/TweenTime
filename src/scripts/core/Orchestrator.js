let Signals = require('js-signals');
let TweenMax = require('TweenMax');
let TimelineMax = require('TimelineMax');
let Quad = require('Quad');
import Utils from './Utils';
import BezierEasing from 'bezier-easing';
let _ = require('lodash');

export default class Orchestrator {
  constructor(timer, data) {
    this.update = this.update.bind(this);
    this.timer = timer;
    this.data = data;
    this.mergeProperties(data);
    this.mainTimeline = new TimelineMax({paused: true});
    this.onUpdate = new Signals.Signal();
    this.timer.updated.add(this.update);
    this.update(0);
    this.onEvent = new Signals.Signal();
  }

  addUpdateListener(listener) {
    this.onUpdate.add(listener);
  }

  removeUpdateListener(listener) {
    this.onUpdate.remove(listener);
  }

  setData(data) {
    this.data = data;
    this.mergeProperties(data);
  }

  getTotalDuration() {
    return this.mainTimeline.totalDuration();
  }

  getEasing(key = false) {
    if (key && key.ease) {
      return Utils.getEasingPoints(key.ease);
    }
    return Utils.getEasingPoints('Quad.easeOut');
  }
  initSpecialProperties(item) {
    // Add a dom element for color tweening and other css properties.
    item._domHelper = document.createElement('div');
    for (var property_key = 0; property_key < item.properties.length; property_key++) {
      var property = item.properties[property_key];
      // Setup special properties
      if (property.type && property.type === 'color') {
        // If the property is a color mark it as css
        property.css = true;
      }

      if (property.css) {
        // If property is a css or a color value apply it to the domHelper element.
        item._domHelper.style[property.name] = property.val;
      }
    }
  }

  initItemValues(item) {
    item.values = {};
    // item._isDirty = true
    for (var property_key = 0; property_key < item.properties.length; property_key++) {
      var property = item.properties[property_key];
      if (property.keys.length) {
        if (typeof property.keys[0].val === 'object') {
          // go trough all properties in val object
          _.forOwn(property.keys[0].val, function(value, key) {
            if (!property.val) {
              property.val = {};
            }
            property.val[key] = Utils.getValueFromKey(value);
          });
        }
        else {
          // Take the value of the first key as initial value.
          // this.todo: update this when the value of the first key change. (when rebuilding the timeline, simply delete item.values before item._timeline)
          property.val = Utils.getValueFromKey(property.keys[0]);
        }
      }
      item.values[property.name] = property.val;
    }
  }

  getKeyAt(property, time_in_seconds) {
    return _.find(property.keys, key => key.time === time_in_seconds);
  }

  mergeProperty(item) {
    var self = this;
    // get all properties with the same parent
    let groups = Utils.groupArray(item.properties, 'parent');
    _.remove(groups, x => {
      return !x.key;
    });
    for (var i = 0; i < groups.length; i++) {
      var group = groups[i];
      // find existing merged property
      var newProperty = item.properties.find(function(pr) {
        return pr.name === group.key;
      });
      if (!newProperty) {
        newProperty = {};
        item.properties.push(newProperty);
      }
      newProperty.name = group.key;
      //newProperty.keys = [];
      // Make first set of keys
      var valueName = group.values[0].name;
      var keys = group.values[0].keys.map(function(k) {
        var newKey = self.getKeyAt(newProperty, k.time) || { val: {} };
        newKey.time = k.time;
        newKey.val[valueName] = { val: k.val, unit: k.unit };
        if (!newKey.ease) {
          newKey.ease = k.ease;
        }
        return newKey;
      });
      newProperty.keys = keys;
      // Add additional vals with the same time
      for (var j = 1; j < group.values.length; j++) {
        var value = group.values[j];
        valueName = value.name;
        for (var p = 0; p < newProperty.keys.length; p++) {
          var propKey = newProperty.keys[p];
          if (value.keys[p]) {
            propKey.val[valueName] = { val: value.keys[p].val, unit: value.keys[p].unit };
          }
        }
      }
    }
  }

  mergeProperties(data) {
    for (var i = 0; i < data.length; i++) {
      this.mergeProperty(data[i]);
    }
  }

  update(timestamp, elapsed) {
    var seconds = timestamp / 1000;
    var seconds_elapsed = elapsed / 1000;

    var has_dirty_items = false;

    for (let i = 0; i < this.data.length; i++) {
      let item = this.data[i];

      if (!item._domHelper) {
        this.initSpecialProperties(item);
      }

      // create the values object to contain all properties
      if (!item.values) {
        this.initItemValues(item);
      }

      // Create the timeline if needed
      if (!item._timeline) {
        item._timeline = new TimelineMax();
        this.mainTimeline.add(item._timeline, 0);
        item._isDirty = true;
      }

      if (item._isDirty) {
        has_dirty_items = true;
      }

      if (item._timeline && item._isDirty && item.properties) {
        item._isDirty = false;
        // item._timeline.clear();

        for (let property_key = 0; property_key < item.properties.length; property_key++) {
          let property = item.properties[property_key];
          if (property._timeline) {
            property._timeline.clear();
          }
          else {
            property._timeline = new TimelineMax();
            item._timeline.add(property._timeline, 0);
          }

          // Add a reference to the parent item for easier reference.
          if (!property._line) {
            property._line = item;
          }

          var propertyTimeline = property._timeline;
          var propName = property.name;

          // If there is no key stop there and set value to default.
          if (!property.keys.length) {
            item.values[property.name] = property.val;
            continue;
          }

          // Set the data values target object.
          var data_target = item.values;
          // Add a inital key, even if there is no animation to set the value from time 0.
          var first_key = property.keys[0];

          var tween_time = 0;
          if (first_key) {
            tween_time = first_key.time;
          }

          var tween_duration = 0;
          var val = {};
          var easing = this.getEasing();
          // Use spread to convert array to multiple arguments.
          val.ease = BezierEasing(...easing);

          if (property.css) {
            data_target = item._domHelper;
            val.css = {};
            val.css[propName] = first_key ? first_key.val : property.val;
          }
          else if (property.name === 'position') {
            val.top = Utils.getValueFromKey(first_key.val.top);
            val.left = Utils.getValueFromKey(first_key.val.left);
            val.right = Utils.getValueFromKey(first_key.val.left);
            val.bottom = Utils.getValueFromKey(first_key.val.left);
            data_target = item.values.position;
          }
          else {
            val[propName] = first_key ? Utils.getValueFromKey(first_key) : property.val;
            if (val[propName] === 'auto') {
              val[propName] = '';
            }
          }

          var tween = TweenMax.to(data_target, tween_duration, val);
          propertyTimeline.add(tween, tween_time);

          for (let key_index = 0; key_index < property.keys.length; key_index++) {
            let key = property.keys[key_index];
            // Add a reference to the parent property, allow easier access
            // without relying on dom order.
            if (!key._property) {
              key._property = property;
            }

            if (key_index < property.keys.length - 1) {
              var next_key = property.keys[key_index + 1];
              tween_duration = next_key.time - key.time;
              if (next_key.ease === 'Linear.instant') {
                tween_duration = 0;
              }

              val = {};
              easing = this.getEasing(next_key);

              // Use spread to convert array to multiple arguments.
              val.ease = BezierEasing(...easing);
              if (property.css) {
                val.css = {};
                val.css[propName] = next_key.val;
              }
              else if (property.name === 'position') {
                val.top = Utils.getValueFromKey(next_key.val.top);
                val.left = Utils.getValueFromKey(next_key.val.left);
                val.right = Utils.getValueFromKey(next_key.val.right);
                val.bottom = Utils.getValueFromKey(next_key.val.bottom);
                data_target = item.values.position;
              }
              else {
                val[propName] = Utils.getValueFromKey(next_key);
                if (val[propName] === 'auto') {
                  val[propName] = '';
                }
              }

              tween = TweenMax.to(data_target, tween_duration, val);
              var time = key.time;
              if (next_key.ease === 'Linear.instant') {
                time = next_key.time;
              }
              propertyTimeline.add(tween, time);
            }
          }

          // Directly seek the property timeline to update the value.
          propertyTimeline.seek(seconds);
        }
        // Force main timeline to refresh but never try to go to < 0
        // to prevent glitches when current time is 0.
        if (seconds > 0) {
          seconds = seconds - 0.0000001;
        }
        else {
          seconds = seconds + 0.0000001;
        }
      }
    }

    // Finally update the main timeline.
    this.mainTimeline.seek(seconds);

    // check if event type property to be fired
    for (let i = 0; i < this.data.length; i++) {
      let item = this.data[i];
      for (let property_key = 0; property_key < item.properties.length; property_key++) {
        let property = item.properties[property_key];
        if (property.type !== 'event') {
          continue;
        }
        for (let key_index = 0; key_index < property.keys.length; key_index++) {
          let key = property.keys[key_index];
          if (seconds_elapsed > 0 && key.time <= seconds && key.time > seconds - seconds_elapsed) {
            this.onEvent.dispatch(property.name, key.val);
          }
        }
      }
    }

    // update the css properties.
    for (let i = 0; i < this.data.length; i++) {
      let item = this.data[i];
      for (let property_key = 0; property_key < item.properties.length; property_key++) {
        let property = item.properties[property_key];
        if (property.css && property.keys.length) {
          // Only css values.
          item.values[property.name] = item._domHelper.style[property.name];
        }
      }
    }

    if (has_dirty_items) {
      this.onUpdate.dispatch();
    }
  }
}
