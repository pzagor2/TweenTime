let d3 = require('d3');
let Signals = require('js-signals');
import Utils from '../core/Utils';

export default class Properties {
  constructor(timeline) {
    this.timeline = timeline;
    this.onKeyAdded = new Signals.Signal();
    this.onKeyRemoved = new Signals.Signal();
    this.subGrp = false;
  }

  propertyVal(d) {
    let filtered = [];
    if (d.properties) {
      if (this.timeline.editor.options.showEmptyProperties) {
        filtered =  d.properties;
      }
      else {
        filtered =  d.properties.filter((prop) => {return prop.keys.length;});
      }

      // filter out properties with parent set
      filtered = filtered.filter(p => {
        return !p.parent;
      });
      filtered.forEach((prop) => prop.indentLevel = d.indentLevel)
    }
    return filtered;
  }

  propertyKey(d) {
    return d.name;
  }

  setSublineHeight(d, i) {
    const sub_height = (i + 1) * this.timeline.lineHeight;
    return 'translate(0,' + sub_height + ')';
  }

  render(bar) {
    var self = this;
    var editor = this.timeline.editor;
    var core = editor.tweenTime;


    var properties = bar.selectAll('.line-item').data((d) => this.propertyVal(d), this.propertyKey);
    var subGrp = properties.enter()
      .append('g')
      .attr('class', 'line-item');

    // Save subGrp in a variable for use in Errors.coffee
    self.subGrp = subGrp;
    this.bar = bar;

    properties.attr('transform', (d, i) => this.setSublineHeight(d, i));

    subGrp.append('rect')
      .attr('class', 'click-handler click-handler--property')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', self.timeline.x(self.timeline.timer.totalDuration + 100))
      .attr('height', self.timeline.lineHeight)
      .on('dblclick', function(d) {
        const lineValue = d._line;
        let def = d.default ? d.default : 0;
        const mouse = d3.mouse(this);
        let dx = self.timeline.x.invert(mouse[0]);
        if (dx < 0) {
          dx = 0;
        }
        dx =  dx.getTime() / 1000;
        dx = Utils.roundTimeFloat(dx);
        const prevKey = Utils.getPreviousKey(d.keys, dx);
        // set the value to match the previous key if we found one
        if (prevKey) {
          def = prevKey.value;
        }
        // d._line = lineValue;
        self.timeline.editor.timelineService.addKey(d._line.id, d.name, dx);
      });

    // Mask
    subGrp.append('svg')
      .attr('class', 'line-item__keys timeline__right-mask')
      .attr('width', window.innerWidth - self.timeline.label_position_x)
      .attr('height', self.timeline.lineHeight)
      .attr('x', -10); // to show whole key diamond. See Keys.js

    this.renderPropertiesLabel(bar, properties);

    this.renderKeyframeToggle(properties);
    this.renderKeyframeValueInput(properties);

    subGrp.append('line')
      .attr('class', 'line-separator--secondary')
      .attr('x1', -self.timeline.margin.left)
      .attr('y1', self.timeline.lineHeight)
      .attr('y2', self.timeline.lineHeight);

    // Hide property line separator if curve editor is enabled.
    bar.selectAll('.line-separator--secondary')
      .attr('x2', function() {
        if (editor.curveEditEnabled) {
          return 0;
        }
        return self.timeline.x(self.timeline.timer.totalDuration + 100);
      });

    bar.selectAll('.line-item').attr('display', function(property) {
      if (!property._line || property._line.collapsed) {
        return 'none';
      }
      return 'block';
    });

    // Hide click handler if curve editor mode.
    bar.selectAll('.click-handler').attr('display', function() {
      if (!editor.curveEditEnabled) {
        return 'block';
      }
      return 'none';
    });

    properties.exit().remove();

    return properties;
  }

  renderPropertiesLabel(bar, subGrp) {
    var _this = this;
    var colorSampleSize = this.timeline.lineHeight * 0.6;
    subGrp.selectAll('.line-label.line-label--sub.line-label--small').remove();
    subGrp.append('text')
      .attr({
        class: 'line-label line-label--sub line-label--small',
        y: this.timeline.lineHeight / 2,
        dy: '0.3em'  // centering
      })
      .text((d) => d.name)
      .on('click', function(d) {
        d._dom = this.parentElement.parentElement;
        _this.timeline.selectionManager.select(d);
      });
    subGrp.select('.line-label')
      .attr({
        x: (d) => this.timeline.label_position_x + this.indentWidthOf(d) + colorSampleSize + 10 + 30
      })
  }

  renderKeyframeToggle(parent) {
    parent.selectAll('.keyframe-toggle').remove();
    const keyframeToggle = parent.append('g')
      .attr('class', 'keyframe-toggle')
      .attr('transform', 'translate(-10, 10)')
      .attr('x', -10)
      .attr('y', 10)
      .attr('stroke', '#bbb')
      .attr('fill', '#bbb')
      .attr('fill-opacity', this.keyframeFillOpacity.bind(this))
      .on('click', (d) => {
        const millis = this.timeline.timer.last_time;
        const seconds = millis / 1000;
        const idx = d.keys.findIndex(k => k.time * 1000 === millis);

        if(idx !== -1) {
          this.timeline.editor.timelineService.removeKey(d.name, d.keys[idx]._id, d._line.id);
        }
        else {
          this.timeline.editor.timelineService.addKey(d._line.id, d.name, seconds);
        }
      });

    keyframeToggle.append('path')
      .attr('d', 'M 0 -6 L 6 0 L 0 6');
    keyframeToggle.append('path')
      .attr('d', 'M 0 -6 L -6 0 L 0 6');

    return keyframeToggle;
  }

  renderKeyframeValueInput(parent) {
    parent.selectAll('.keyframe-value').remove();
    const v = parent.append('g')
      .attr('class', 'line-label--small keyframe-value')
      .attr('transform', 'translate(-70, 14)')
      .append('text')
      .html(this.keyframeValueHTML.bind(this))
      .attr('text-anchor', 'middle');

    return v;
  }

  keyframeValueHTML(d) {

    const millis = this.timeline.timer.last_time;
    const seconds = millis / 1000;
    const prevKey = Utils.getPreviousKey(d.keys, seconds);
    const currentKey = d.keys.find(k => k.time * 1000 === millis);
    const val = currentKey ? currentKey.value : '';

    if(d.name === 'size' && val !== '') {
      // Sometimes _line is undefined, I noticed it while editor/creative was initaly loading
      if (d._line) {
        const w = this.timeline.editor.timelineService.applyAnimationValue(d._line.id, val, 'width');
        const h = this.timeline.editor.timelineService.applyAnimationValue(d._line.id, val, 'height');
        return `<tspan class="keyframe-value-input">${w}</tspan>(w) x <tspan class="keyframe-value-input">${h}</tspan>(h)`;
      }
    }

    if(d.name === 'position' && val !== '') {
      // Sometimes _line is undefined, I noticed it while editor/creative was initaly loading
      if (d._line) {
        const x = this.timeline.editor.timelineService.applyAnimationValue(d._line.id, val, 'x');
        const y = this.timeline.editor.timelineService.applyAnimationValue(d._line.id, val, 'y');
        return `<tspan class="keyframe-value-input">${x}</tspan>(x) x <tspan class="keyframe-value-input">${y}</tspan>(y)`;
      }
    }

    if (d.name === 'opacity' && val !== '') {
      const valPercentage = val * 100;
      return `<tspan class="keyframe-value-input">${valPercentage}</tspan>%`;
    }

    if (d.name === 'scale' && val !== '') {
      const valPercentage = val * 100;
      return `<tspan class="keyframe-value-input">${valPercentage}</tspan>%`;
    }

    if(typeof val === 'number') {
      return `<tspan class="keyframe-value-input">${val.toFixed(2)}°</tspan>`;
    }

    return val;
  }

  /**
   * This needs to get called when one of the property values could change
   *
   * Such as when the time changes (prop value could differ on another keyframe)
   * or when an element is moved, resized, etc. (since that would change the values)
   */
  onUpdate() {
    if(!this.bar) {
      return;
    }

    this.bar.selectAll('.keyframe-toggle').attr('fill-opacity', this.keyframeFillOpacity.bind(this));
    this.bar.selectAll('.keyframe-value text').html(this.keyframeValueHTML.bind(this));
  }

  keyframeFillOpacity(d) {
    const millis = this.timeline.timer.last_time;
    return d.keys.find(k => k.time * 1000 === millis) ? 1 : 0;
  }

  indentWidthOf(d) {
    return d.indentLevel ? d.indentLevel * 16 : 0;
  }
}
