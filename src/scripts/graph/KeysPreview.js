// Actually this is not keys preview but transition preview
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

    var keyValue = function(d) {
      return d.keys;
    };
    var keyKey = function(d) {
      return d.time;
    };

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
