let d3 = require('d3');

import Utils from '../core/Utils';
import Header from './Header';
import TimeIndicator from './TimeIndicator';
import Items from './Items';
import KeysPreview from './KeysPreview';
import Properties from './Properties';
import PropertyCurveEdit from './PropertyCurveEdit';
import Keys from './Keys';
import Errors from './Errors';
import Selection from './Selection';

export default class Timeline {
  constructor(editor, options) {
    this.editor = editor;
    this.tweenTime = this.editor.tweenTime;
    this.timer = this.tweenTime.timer;
    this.selectionManager = this.editor.selectionManager;
    this.selectionManager.onSelect.add(() => {
      // Needed to apply selection of properties/item to curves.
      this._isDirty = true;
      this.render();
    });

    this._isDirty = true;
    this.timer = this.tweenTime.timer;
    this.currentTime = this.timer.time; // used in timeindicator.

    this.onUpdate = this.onUpdate.bind(this);

    // Make the domain cover 20% of the totalDuation by default.
    this.initialDomain = [];
    this.initialDomain[0] = options.domainStart || 0;
    this.initialDomain[1] = options.domainEnd || this.timer.totalDuration * 0.2;

    // Adapt time to be greater or equal to domainStart.
    if (this.initialDomain[0] > this.timer.getCurrentTime()) {
      this.timer.time[0] = this.initialDomain[0];
    }

    var margin = {top: 6, right: 20, bottom: 0, left: 265, extraRight: 270};
    this.margin = margin;
    var width = window.innerWidth - margin.left - margin.right - margin.extraRight;
    var height = 270 - margin.top - margin.bottom - 40;
    this.lineHeight = options.lineHeight || 20;
    this.propertyLineHeight = options.propertyLineHeight || 20;
    this.separatorHeight = options.separatorHeight || 1;
    this.label_position_x = -margin.left + 20;

    this.x = d3.time.scale()
      .domain(this.initialDomain)
      .range([0, width]);

    this.xAxis = d3.svg.axis()
      .scale(this.x)
      .orient('top')
      .ticks(10)
      .tickSize(-height, 0)
      .tickFormat(Utils.formatSeconds);

    this.xSmallRulerAxis = d3.svg.axis()
      .scale(this.x)
      .orient('top')
      .ticks(this.xAxis.ticks() * 10)
      .tickSize(4, 0)
      .tickFormat('');

    this.xBigRulerAxis = d3.svg.axis()
      .scale(this.x)
      .orient('top')
      .ticks(this.xAxis.ticks() * 2)
      .tickSize(6, 0)
      .tickFormat('');

    this.svgGrid = d3.select(editor.$timeline.get(0)).select('.timeline__grid').append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', 600)
      .attr('class', 'time-grid-container');

    this.svg = d3.select(editor.$timeline.get(0)).select('.timeline__main').append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', 600)
      .attr('class', 'lines-time-container');


    this.linesContainer = this.svg.append('g')
      .attr('transform', 'translate(' + margin.left + ',' + (margin.top - 15) + ')');

    this.svgContainer = this.svgGrid.append('g')
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    this.svgContainerTime = this.svg.append('g')
      .attr('transform', 'translate(' + margin.left + ',0)');


    this.header = new Header(editor, this.timer, this.initialDomain, this.tweenTime, width, margin);
    this.timeIndicator = new TimeIndicator(this, this.svgContainerTime);

    this.selection = new Selection(this, this.svg, margin);

    this.items = new Items(this, this.linesContainer);
    this.items.onUpdate.add(this.onUpdate);
    this.keysPreview = new KeysPreview(this, this.linesContainer);

    this.properties = new Properties(this);
    this.properties.onKeyAdded.add((newKey) => {
      this._isDirty = true;
      // render the timeline directly so that we can directly select
      // the new key with it's domElement.
      this.render(0, false);
      this.keys.selectNewKey(newKey);
    });
    this.properties.onKeyRemoved.add((removedKey) => {
      this._isDirty = true;
      this.render(0, false);
    });
    this.errors = new Errors(this);
    this.keys = new Keys(this);
    this.keys.onKeyUpdated.add(() => {
      this.onUpdate();
    });

    this.curves = new PropertyCurveEdit(this, this.linesContainer);
    this.curves.onCurveUpdated.add(() => {
      this._isDirty = true;
      // render the timeline directly so that we can directly select
      // the new key with it's domElement.
      this.render(0, false);
    });

    this.xAxisGrid = d3.svg.axis()
      .scale(this.x)
      .ticks(100)
      .tickSize(-this.items.dy, 0)
      .tickFormat('')
      .orient('top');


    this.xGrid = this.svgContainer.append('g')
      .attr('class', 'x axis grid')
      .attr('transform', 'translate(0,' + margin.top + ')')
      .call(this.xAxisGrid);

    this.xSmallRulerElement = this.svgContainer.append('g')
      .attr('class', 'x ruler ruler--small')
      .attr('transform', 'translate(0,' + (margin.top + 7) + ')')
      .call(this.xSmallRulerAxis);

    this.xBigRulerElement = this.svgContainer.append('g')
      .attr('class', 'x ruler ruler--big')
      .attr('transform', 'translate(0,' + (margin.top + 7) + ')')
      .call(this.xBigRulerAxis);

    this.xAxisElement = this.svgContainer.append('g')
      .attr('class', 'x axis')
      .attr('transform', 'translate(0,' + margin.top + ')')
      .call(this.xAxis);

    this.verticalSeparator = this.svgContainer.append('line')
      .attr('class', 'vertical-separator')
      .attr('stroke', '#000')
      .attr({
        x1: -10,
        y1: -10,
        x2: -10,
        y2: 600,
      });

    this.header.onBrush.add((extent) => {
      this.x.domain(extent);
      this.xGrid.call(this.xAxisGrid);
      this.xAxisElement.call(this.xAxis);
      this.xSmallRulerElement.call(this.xSmallRulerAxis);
      this.xBigRulerElement.call(this.xBigRulerAxis);
      this._isDirty = true;
    });

    // First render
    window.requestAnimationFrame(() => {this.render();});

    window.onresize = (ev) => {
      // Editor marquee is triggering resize event with different target set. This makes sure we don't execute this code.
      if (ev.target !== window) {
        return;
      }
      this.resize();
    };
  }

  onUpdate() {
    this.editor.render(false, false, true);
  }

  setHeaderDomain(domain) {
    this.header.setHeaderDomain(domain);
  }

  getHeaderDomain() {
    return this.header.getHeaderDomain();
  }

  addHeaderDomainChangeListener(listener) {
    this.header.adOnBrushChangeListener(listener);
  }

  removeHeaderDomainChangeListener(listener) {
    this.header.removeOnBrushChangeListener(listener);
  }

  render(time, time_changed) {
    if (time_changed) {
      var domainLength;
      // Update current domain when playing to keep time indicator in view.
      var margin_ms = 16;
      if (this.timer.getCurrentTime() > this.initialDomain[1]) {
        domainLength = this.initialDomain[1] - this.initialDomain[0];
        this.initialDomain[0] += domainLength - margin_ms;
        this.initialDomain[1] += domainLength - margin_ms;
        this.header.setDomain(this.initialDomain);
      }
      if (this.timer.getCurrentTime() < this.initialDomain[0]) {
        domainLength = this.initialDomain[1] - this.initialDomain[0];
        this.initialDomain[0] = this.timer.getCurrentTime();
        this.initialDomain[1] = this.initialDomain[0] + domainLength;
        this.header.setDomain(this.initialDomain);
      }
    }

    if (this._isDirty || time_changed) {
      // Render header and time indicator everytime the time changed.
      this.header.render();
      this.timeIndicator.render();
      this.properties.onUpdate();
    }

    if (this._isDirty) {
      // No need to call this on each frames, but only on brush, key drag, ...
      this.updateKeyDurations(this.tweenTime.data);
      var bar = this.items.render();
      this.keysPreview.render(bar);
      var properties = this.properties.render(bar);
      this.errors.render(properties);
      this.keys.render(properties);
      this.curves.render(bar);
      this._isDirty = false;

      // Adapt the timeline height.
      var height = Math.max(this.items.dy + 30, this.editor.$timeline.height() - 22);
      this.xAxis.tickSize(-height, 0);
      this.xAxisGrid.tickSize(-height, 0);
      this.xGrid.call(this.xAxisGrid);
      this.xAxisElement.call(this.xAxis);
      this.xSmallRulerElement.call(this.xSmallRulerAxis);
      this.xBigRulerElement.call(this.xBigRulerAxis);
      this.svg.attr('height', height - 30);
      this.svgGrid.attr('height', height);
      this.verticalSeparator.attr('y2', height);
      this.timeIndicator.updateHeight(height);
    }
  }

  updateKeyDurations(elements) {
    elements.forEach((element) => {
      element.properties.forEach((property) => {
        property.keys.forEach((key, index, keys) => {
          key.duration = this.calculateDuration(key, index, keys);
        });
      });
    });
    return elements;
  }

  calculateDuration(key, index, keys) {
    var nextKey = keys[index + 1];
    if (!nextKey) {
      return 0;
    }

    var duration = this.deepEqual(key.value, nextKey.value) ? 0 : nextKey.time - key.time;
    return duration;
  }

  // maybe there has been something reusable instead of this
  deepEqual(v1, v2) {
    var result
    if (typeof v1 === 'object' && typeof v2 === 'object') {
      var keys = Object.keys(v1);
      if (keys.length !== Object.keys(v2).length) {
        result = false;
      }
      else {
        result = keys.every((key) => this.deepEqual(v1[key], v2[key]))
      }
    }
    else {
      result = v1 === v2;
    }
    return result;
  }

  resize(newExtraRight) {
    if (newExtraRight !== undefined) {
      this.margin.extraRight = Number(newExtraRight) || 0;
    }

    var margin = this.margin;
    var INNER_WIDTH = window.innerWidth - margin.extraRight;
    var width2 = INNER_WIDTH - margin.left - margin.right;
    this.svg.attr('width', width2 + margin.left + margin.right);
    this.svg.selectAll('.timeline__right-mask')
      .attr('width', INNER_WIDTH);
    this.x.range([0, width2]);
    this.svgGrid.attr('width', width2 + margin.left + margin.right);

    this._isDirty = true;
    this.header.resize(INNER_WIDTH);
    this.render();
  }
}
