export default class EditorControls {
  constructor(tweenTime, $timeline) {
    this.tweenTime = tweenTime;
    this.$timeline = $timeline;
    this.timer = this.tweenTime.timer;
    this.$time = this.$timeline.find('.control--time');
    this.$time_end = this.$timeline.find('.control--time-end');
    this.initControls();
    this.$time_end.val(this.tweenTime.timer.getDuration());
    this.timer.addStatusChangedListener(this.timerStatusChnageListener.bind(this));

    $(document).keypress((e) => {
      if (e.charCode === 32) {
        // Space
        this.playPause();
      }
    });
  }

  timerStatusChnageListener(playing) {
    var $play_pause = this.$timeline.find('.control--play-pause');
    $play_pause.toggleClass('icon-pause', playing);
    $play_pause.toggleClass('icon-play', !playing);
  }

  playPause() {
    this.timer.toggle();
  }

  backward() {
    this.timer.seek([0]);
  }

  forward() {
    var total = this.tweenTime.getTotalDuration();
    this.timer.seek([total * 1000]);
  }

  changeTimeEnd(seconds) {
    this.timer.setDuration(seconds);
  }

  changeTime(seconds) {
    this.timer.seek([seconds]);
  }

  initControls() {
    var $play_pause = this.$timeline.find('.control--play-pause');
    $play_pause.click((e) => {
      e.preventDefault();
      this.playPause();
    });
    var $bt_first = this.$timeline.find('.control--first');
    $bt_first.click((e) => {
      e.preventDefault();
      this.backward();
    });
    var $bt_last = this.$timeline.find('.control--last');
    $bt_last.click((e) => {
      e.preventDefault();
      this.forward();
    });
    this.$time.change(() => {
      var seconds = parseFloat(this.$time.val(), 10) * 1000;
      this.changeTime(seconds);
    });
    this.$time_end.change(() => {
      var seconds = parseFloat(this.$time_end.val(), 10);
      this.changeTimeEnd(seconds);
    });
  }

  render(time, time_changed) {
    if (time_changed) {
      var seconds = time / 1000;
      this.$time.val(seconds.toFixed(3));
    }
  }
}
