(function (root, Rx) {
  Rx.events = {};
  ['change', 'click'].forEach(function (event) {
    Rx.events[event] = function (element, selector) {
      return Rx.Observable.fromEvent(element, event, selector);
    };
  });

  // Get the right animation frame method
  var requestAnimFrame, cancelAnimFrame;
  if (root.requestAnimationFrame) {
    requestAnimFrame = root.requestAnimationFrame;
    cancelAnimFrame = root.cancelAnimationFrame;
  } else if (root.mozRequestAnimationFrame) {
    requestAnimFrame = root.mozRequestAnimationFrame;
    cancelAnimFrame = root.mozCancelAnimationFrame;
  } else if (root.webkitRequestAnimationFrame) {
    requestAnimFrame = root.webkitRequestAnimationFrame;
    cancelAnimFrame = root.webkitCancelAnimationFrame;
  } else if (root.msRequestAnimationFrame) {
    requestAnimFrame = root.msRequestAnimationFrame;
    cancelAnimFrame = root.msCancelAnimationFrame;
  } else if (root.oRequestAnimationFrame) {
    requestAnimFrame = root.oRequestAnimationFrame;
    cancelAnimFrame = root.oCancelAnimationFrame;
  } else {
    requestAnimFrame = function(cb) { root.setTimeout(cb, 1000 / 60); };
    cancelAnimFrame = root.clearTimeout;
  }

  /**
  * Gets a scheduler that schedules schedules work on the requestAnimationFrame for immediate actions.
  */
  Rx.Scheduler.requestAnimationFrame = (function () {

    function scheduleNow(state, action) {
      var scheduler = this,
      disposable = new Rx.SingleAssignmentDisposable();
      var id = requestAnimFrame(function () {
        !disposable.isDisposed && (disposable.setDisposable(action(scheduler, state)));
      });
      return new Rx.CompositeDisposable(disposable, Rx.Disposable.create(function () {
        cancelAnimFrame(id);
      }));
    }

    function scheduleRelative(state, dueTime, action) {
      var scheduler = this,
          dt = Rx.Scheduler.normalize(dueTime);
      if (dt === 0) { return scheduler.scheduleWithState(state, action); }

      var disposable = new Rx.SingleAssignmentDisposable();

      var id = root.setTimeout(function () {
        if (!disposable.isDisposed) {
          disposable.setDisposable(action(scheduler, state));
        }
      }, dt);

      return new Rx.CompositeDisposable(disposable, Rx.Disposable.create(function () {
        root.clearTimeout(id);
      }));
    }

    function scheduleAbsolute(state, dueTime, action) {
      return this.scheduleWithRelativeAndState(state, dueTime - this.now(), action);
    }

    return new Rx.Scheduler(Date.now, scheduleNow, scheduleRelative, scheduleAbsolute);

  }());

}(this, this.Rx));
