let d3 = require('d3');
let Signals = require('js-signals');
let _ = require('lodash');
import Utils from '../core/Utils';

export default class Items {
  constructor(timeline, container) {
    this.timeline = timeline;
    this.container = container;
    this.dy = 10 + this.timeline.margin.top;
    this.onUpdate = new Signals.Signal();
    // this.timeline.selectionManager.addOnSelectListener(this.onSelectionChanged.bind(this));
  }

  // onSelectionChanged(selection) {
  //   console.log('selection changed');
  //   if (!selection || selection.length <= 0) {
  //     d3.selectAll('.line-label').classed('line-selected', false);
  //   }
  // }

  render() {
    const self = this;
    const tweenTime = self.timeline.tweenTime;
    const editor = self.timeline.editor;

    const selectBar = function(data) {
      data._dom = this.parentNode;
      self.timeline.selectionManager.select(data);
      // d3.selectAll('.line-label').classed('line-selected', false);
      // d3.select(this).classed('line-selected', true);
    };

    // const selectProperty = function(data) {
    //   self.timeline.selectionManager.select(data.properties[0]);
    // };


    const dragmove = function(d) {
      const dx = self.timeline.x.invert(d3.event.x).getTime() / 1000;
      const diff = dx - d.start;
      d.start += diff;
      d.end += diff;
      if (d.properties) {
        for (var prop_key = 0; prop_key < d.properties.length; prop_key++) {
          var prop = d.properties[prop_key];
          for (var i = 0; i < prop.keys.length; i++) {
            var key = prop.keys[i];
            key.time += diff;
          }
        }
      }
      d._isDirty = true;
      self.onUpdate.dispatch();
    };

    const dragmoveLeft = function(d) {
      d3.event.sourceEvent.stopPropagation();
      var sourceEvent = d3.event.sourceEvent;
      var dx = self.timeline.x.invert(d3.event.x).getTime() / 1000;
      var timeMatch = false;
      if (sourceEvent.shiftKey) {
        timeMatch = Utils.getClosestTime(tweenTime.data, dx, d.id, false, tweenTime.timer);
      }
      if (!timeMatch) {
        var diff = dx - d.start;
        timeMatch = d.start + diff;
      }
      d.start = timeMatch;
      d._isDirty = true;
      self.onUpdate.dispatch();
    };

    const dragmoveRight = function(d) {
      d3.event.sourceEvent.stopPropagation();
      var sourceEvent = d3.event.sourceEvent;
      var dx = self.timeline.x.invert(d3.event.x).getTime() / 1000;
      var timeMatch = false;
      if (sourceEvent.shiftKey) {
        timeMatch = Utils.getClosestTime(tweenTime.data, dx, false, false, tweenTime.timer);
      }
      if (!timeMatch) {
        var diff = dx - d.end;
        timeMatch = d.end + diff;
      }
      d.end = timeMatch;
      d._isDirty = true;
      self.onUpdate.dispatch();
    };

    const dragLeft = d3.behavior.drag()
      .origin(function() {
        var t = d3.select(this);
        return {x: t.attr('x'), y: t.attr('y')};
      })
      .on('drag', dragmoveLeft);

    const dragRight = d3.behavior.drag()
      .origin(function() {
        var t = d3.select(this);
        return {x: t.attr('x'), y: t.attr('y')};
      })
      .on('drag', dragmoveRight);

    const drag = d3.behavior.drag()
      .origin(function() {
        var t = d3.select(this);
        return {x: t.attr('x'), y: t.attr('y')};
      })
      .on('drag', dragmove);

    // remove whole data once in order to update
    // there should be a better way tho
    this.container.selectAll('.line-grp')
      .data([])
      .exit().remove();

    const bar_border = 1;
    const bar = this.container.selectAll('.line-grp')
      .data(this.timeline.tweenTime.data, (d) => {
        return d.id;
      });

    const barEnter = bar.enter()
      .append('g')
      .attr('class', 'line-grp')
      .attr('data-element-type', d => d.elementType || 'unknown');

    // Create highlight layer
    barEnter.append('rect')
      .attr('class', 'highlight-layer')
      .attr('x', -300)
      .attr('y', 0)
      .attr('width', window.innerWidth - self.timeline.label_position_x)
      .attr('height', 22);

    const barContainerRight = barEnter.append('svg')
      .attr({
        class: 'timeline__right-mask',
        y: self.timeline.lineHeight / 2 - 12,
        width: window.innerWidth - self.timeline.label_position_x
      });

    bar.select('.timeline__right-mask')
      .attr({
        display: () => self.timeline.editor.curveEditEnabled ? 'none' : 'block',
        height: (d) => (d.properties.length + 1) * self.timeline.lineHeight
      });

    barContainerRight.append('rect')
      .attr('class', 'bar')
      // Add a unique id for SelectionManager.removeDuplicates
      .attr('id', () => {return Utils.guid();})
      .attr('y', 3)
      .attr('height', 14);

    barContainerRight.append('rect')
      .attr('class', 'bar-anchor bar-anchor--left')
      .attr('y', 2)
      .attr('height', 16)
      .attr('width', 6)
      .call(dragLeft);

    barContainerRight.append('rect')
      .attr('class', 'bar-anchor bar-anchor--right')
      .attr('y', 2)
      .attr('height', 16)
      .attr('width', 6)
      .call(dragRight);

    self.dy = 10 + this.timeline.margin.top;
    bar.attr('transform', function(d) {
      var y = self.dy;
      self.dy += self.timeline.lineHeight;
      if (!d.collapsed) {
        var numProperties = 0;
        if (d.properties) {
          var visibleProperties = _.filter(d.properties, function(prop) {
            return prop.keys.length;
          }).filter(function(p) {
            return !p.parent;
          });
          numProperties = visibleProperties.length;
        }
        self.dy += numProperties * self.timeline.lineHeight;
      }
      return 'translate(0,' + y + ')';
    });

    const barWithStartAndEnd = function(d) {
      if (d.start !== undefined && d.end !== undefined) {
        return true;
      }
      return false;
    };

    bar.selectAll('.bar-anchor--left')
      .filter(barWithStartAndEnd)
      .attr('x', (d) => {return self.timeline.x(d.start * 1000) - 1;})
      .on('mousedown', function() {
        // Don't trigger mousedown on linescontainer else
        // it create the selection rectangle
        d3.event.stopPropagation();
      });

    bar.selectAll('.bar-anchor--right')
      .filter(barWithStartAndEnd)
      .attr('x', (d) => {return self.timeline.x(d.end * 1000) - 1;})
      .on('mousedown', function() {
        // Don't trigger mousedown on linescontainer else
        // it create the selection rectangle
        d3.event.stopPropagation();
      });


    bar.selectAll('.bar')
      .filter(barWithStartAndEnd)
      .attr('x', (d) => {return self.timeline.x(d.start * 1000) + bar_border;})
      .attr('width', function(d) {
        return Math.max(0, (self.timeline.x(d.end) - self.timeline.x(d.start)) * 1000 - bar_border);
      })
      .call(drag)
      .on('click', selectBar)
      // .on('dblclick', selectProperty)
      .on('mousedown', function() {
        // Don't trigger mousedown on linescontainer else
        // it create the selection rectangle
        d3.event.stopPropagation();
      });

    function indentWidthOf(d) {
      return d.indentLevel ? d.indentLevel * 16 : 0;
    }

    function wrap(d) {
      const width = 200 - indentWidthOf(d);
      const padding = 2;
      const _self = d3.select(this);
      let textLength = _self.node().getComputedTextLength();
      let text = _self.text();
      while (textLength > width - 2 * padding && text.length > 0) {
        text = text.slice(0, -1);
        _self.text(text + '...');
        textLength = _self.node().getComputedTextLength();
      }
    }

    const lineLabelStyle = [
      self.timeline.fontFamily && `font-family: ${self.timeline.fontFamily}`,
      self.timeline.fontSize && `font-size: ${self.timeline.fontSize}px`
    ].filter((d) => d).join(';');
    barEnter.append('text')
      .attr('class', 'line-label')
      .attr('style', lineLabelStyle)
      .attr('x', (d) => {
        return self.timeline.label_position_x + indentWidthOf(d) + self.timeline.fontSize + 10;
      })
      .attr('y', self.timeline.lineHeight / 2)
      .attr('dy', '0.3em')  // centering
      .text((d) => {
        return d.label;
      })
      .each(wrap)
      .on('click', selectBar)
      // .on('dblclick', selectProperty)
      .on('mousedown', function() {
        // Don't trigger mousedown on linescontainer else
        // it create the selection rectangle
        d3.event.stopPropagation();
      });

    barEnter.append('rect')
      .attr('class', 'line-colorSample')
      .attr('x', (d) => {
        return self.timeline.label_position_x + indentWidthOf(d) + 5;
      })
      .attr('y', (self.timeline.lineHeight - self.timeline.fontSize) / 2)
      .attr('width', self.timeline.fontSize)
      .attr('height', self.timeline.fontSize)

    barEnter.append('text')
      .attr('class', 'line__toggle')
      .attr('x', (d) => {
        return self.timeline.label_position_x - 10 + indentWidthOf(d);
      })
      .attr('y', self.timeline.lineHeight / 2)
      .attr('dy', '0.3em')  // centering
      .on('click', function(d) {
        var foundItem = _.find(self.timeline.tweenTime.data, { id: d.id });
        foundItem.collapsed = !foundItem.collapsed;
        self.onUpdate.dispatch();
      });

    bar.selectAll('.line__toggle').text(function(d) {
      var foundItem = _.find(self.timeline.tweenTime.data, { id: d.id });
      if (foundItem.collapsed) {
        return '▸';
      }
      return '▾';
    });

    barEnter.append('line')
      .attr('class', 'line-separator')
      .attr('x1', -self.timeline.margin.left)
      .attr('y1', self.timeline.lineHeight)
      .attr('y2', self.timeline.lineHeight);

    // Hide property line separator if curve editor is enabled.
    bar.selectAll('.line-separator')
      .attr('x2', function() {
        if (editor.curveEditEnabled) {
          return 0;
        }
        return self.timeline.x(self.timeline.timer.totalDuration + 100);
      });

    bar.exit().remove();

    return bar;
  }
}
