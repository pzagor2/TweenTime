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
        const newKey = {
          time: dx,
          value: def,
          _property: d
        };
        if (core.options.defaultEase) {
          newKey.ease = core.options.defaultEase;
        }

        d.keys.push(newKey);
        // Sort the keys for tweens creation
        d.keys = Utils.sortKeys(d.keys);
        lineValue._isDirty = true;

        lineValue._isDirty = true;
        self.onKeyAdded.dispatch(newKey);
      });

    // Mask
    subGrp.append('svg')
      .attr('class', 'line-item__keys timeline__right-mask')
      .attr('width', window.innerWidth - self.timeline.label_position_x)
      .attr('height', self.timeline.lineHeight);

    this.renderPropertiesLabel(bar, properties);

    this.renderKeyframeToggle(subGrp);
    this.renderKeyframeValueInput(subGrp);

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
      if (property._line.collapsed) {
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
    subGrp.select('text')
      .attr({
        x: (d) => this.timeline.label_position_x + this.indentWidthOf(d) + colorSampleSize + 10
      })
  }

  renderKeyframeToggle(subGrp) {
    const keyframeToggle = subGrp.append('g')
      .attr('class', 'keyframe-toggle')
      .attr('transform', 'translate(-10, 10)')
      .attr('x', -10)
      .attr('y', 10)
      .attr('stroke', 'black')
      .attr('fill', 'blue')
      .attr('fill-opacity', this.keyframeFillOpacity.bind(this))
      .on('click', (d) => {
        const millis = this.timeline.timer.last_time;
        const seconds = millis / 1000;
        const idx = d.keys.findIndex(k => k.time * 1000 === millis);

        if(idx !== -1) {
          const [removedKey] = d.keys.splice(idx, 1);
          d._line._isDirty = true;
          this.onKeyRemoved.dispatch(removedKey);
        }
        else {
          const def = d.default ? d.default : 0;
          const prevKey = Utils.getPreviousKey(d.keys, seconds);
          const newKey = {
            time: seconds,
            value: prevKey ? prevKey.value : def,
            _property: d
          };

          const core = this.timeline.editor.tweenTime;
          if(core.options.defaultEase) {
            newKey.ease = core.options.defaultEase;
          }

          d.keys.push(newKey);
          d.keys = Utils.sortKeys(d.keys);

          d._line._isDirty = true;
          this.onKeyAdded.dispatch(newKey);
        }
      });

    keyframeToggle.append('path')
      .attr('d', 'M 0 -6 L 6 0 L 0 6');
    keyframeToggle.append('path')
      .attr('d', 'M 0 -6 L -6 0 L 0 6');

    return keyframeToggle;
  }

  renderKeyframeValueInput(subGrp) {
    const v = subGrp.append('g')
      .attr('class', 'keyframe-value-input')
      .attr('transform', 'translate(-120, 6)')
      .append('text')
      .attr('font-size', 13)
      .attr('transform', 'translate(0, 10)')
      .attr('fill', 'blue')
      .attr('text-decoration', 'underline')
      .text(this.keyframeValue.bind(this));

    return v;
  }

  keyframeValue(d) {
    const millis = this.timeline.timer.last_time;
    const seconds = millis / 1000;
    const prevKey = Utils.getPreviousKey(d.keys, seconds);
    const currentKey = d.keys.find(k => k.time * 1000 === millis);
    const val = currentKey ? currentKey.value : '';

    if(d.name === 'size' && val !== '') {
      const w = this.timeline.editor.timelineService.applyAnimationValue(d._line.id, val, 'width');
      const h = this.timeline.editor.timelineService.applyAnimationValue(d._line.id, val, 'height');
      return `${w}(w) x ${h}(h)`;
    }

    if(d.name === 'position' && val !== '') {
      const x = this.timeline.editor.timelineService.applyAnimationValue(d._line.id, val, 'x');
      const y = this.timeline.editor.timelineService.applyAnimationValue(d._line.id, val, 'y');
      return `${x}(x) x ${y}(y)`;
    }

    return val;
  }

  onTimeChanged() {
    if(!this.bar) {
      return;
    }

    this.bar.selectAll('.keyframe-toggle').attr('fill-opacity', this.keyframeFillOpacity.bind(this));
    this.bar.selectAll('.keyframe-value-input text').text(this.keyframeValue.bind(this));
  }

  keyframeFillOpacity(d) {
    const millis = this.timeline.timer.last_time;
    return d.keys.find(k => k.time * 1000 === millis) ? 1 : 0;
  }

  indentWidthOf(d) {
    return d.indentLevel ? d.indentLevel * 16 : 0;
  }
}
