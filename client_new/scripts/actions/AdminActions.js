define([
  'dispatcher/AppDispatcher',
  'constants/AppConstants'
], function(
  AppDispatcher,
  AppConstants
){
  var AdminActions = {
    pause: function() {
      AppDispatcher.handleViewAction({
        actionType: AppConstants.ActionTypes.ADMIN_PAUSE_GAME
      });
    },
    resume: function() {
      AppDispatcher.handleViewAction({
        actionType: AppConstants.ActionTypes.ADMIN_RESUME_GAME
      });
    }
  };

  return AdminActions;
});
