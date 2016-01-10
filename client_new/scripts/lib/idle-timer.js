define([
  'lodash',
  'lib/events'
], function(
  _,
  Events
){
  'use strict';

  function IdleTimer(opts) {
    if (!(this instanceof IdleTimer) )
      return new IdleTimer(opts);

    _.extend(this, Events);

    var self        = this;
    var timeout     = opts.timeout || 5 * 60 * 1000; // 5 minutes default

    // If we're firing idle / active events.
    var enabled   = true;

    // Assume we're active when loaded.
    var idle      = false;
    var idleTimer = null;

    self.register = function() {
      // Setup the window handlers.
      window.addEventListener('focus', onFocus);
      window.addEventListener('blur', onBlur);
    };

    self.unregister = function() {
      // Setup the window handlers.
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };

    self.setState = function(state) {
      enabled = state && true;
    };

    // Private functions
    function onBlur() {
      // Is probably null, but clear anyway.
      clearTimeout(idleTimer);

      enabled && self.trigger('blur');

      // Install new idle timeout.
      idleTimer = setTimeout(onIdle, timeout);
    }

    function onFocus() {
      clearTimeout(idleTimer);

      // Fire 'focus' independent of idle state.
      enabled && self.trigger('focus');

      // Only fire 'active' if idle state changed.
      if (idle) enabled && self.trigger('unidle');
      idle = false;
      idleTimer = null;
    }

    function onIdle() {
      if (!idle) enabled && self.trigger('idle');
      idle = true;
      idleTimer = null;
    }

    return self;
  }

  return IdleTimer;
});
