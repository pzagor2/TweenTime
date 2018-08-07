export default class KeysPreview {
  constructor(timeline, container) {
    this.timeline = timeline;
    this.container = container;
  }

  render(bar) {
    var self = this;

    var propVal = function(d) {
      if (d.properties) {
        return d.properties;
      }

      return [];
    };
    var propKey = function(d) {
      return d.name;
    };

    var properties = bar.select('.timeline__right-mask').selectAll('.keys-preview').data(propVal, propKey);

    properties.enter()
      .append('g')
      .attr('class', 'keys-preview');

    var setItemStyle = function(d) {
      if (!d._property || !d._property._line) {
        return 'display: none;';
      }
      const lineData = d._property._line;
      if (lineData.collapsed === true) {
        return '';
      }
      // Show only when item is collapsed
      return 'display: none;';
    };

    properties.selectAll('.key--preview')
      .attr('style', setItemStyle);

    var keyValue = function(d) {
      return d.keys;
    };
    var keyKey = function(d) {
      return d.time;
    };
    var keys = properties.selectAll('.key--preview').data(keyValue, keyKey);

    keys.enter()
      .append('path')
      .attr('class', 'key--preview')
      .attr('style', setItemStyle)
      .attr('d', 'M 0 -4 L 4 0 L 0 4 L -4 0');

    keys.attr('transform', function(d) {
      let dx = self.timeline.x(d.time * 1000);
      dx = parseInt(dx, 10);
      let dy = 11;
      return 'translate(' + dx + ',' + dy + ')';
    });

    keys.exit().remove();

    var transitionBars = properties.selectAll('.key--transitionBar')
      .data(keyValue, keyKey)
      .attr({
        x: (key) => self.timeline.x(key.time * 1000 || 0),
        width: (key) => self.timeline.x(key.duration * 1000 || 0)
      });

    transitionBars.enter().append('rect')
      .attr({
        class: 'key--transitionBar',
        fill: 'white',
        'fill-opacity': 0.5,
        height: 20,
        x: (key) => self.timeline.x(key.time * 1000 || 0),
        y: -2.3,
        width: (key) => self.timeline.x(key.duration * 1000 || 0)
      });

    transitionBars.exit().remove();
  }
}
