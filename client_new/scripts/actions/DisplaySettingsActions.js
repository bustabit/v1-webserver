define([
    'dispatcher/AppDispatcher',
    'constants/AppConstants'
], function(
    AppDispatcher,
    AppConstants
){

    var DisplaySettingsActions = {

        setControlsSize: function(controlsSize) {
            AppDispatcher.handleViewAction({
                actionType: AppConstants.ActionTypes.SET_CONTROLS_SIZE,
                controlsSize: controlsSize
            });
        },

        setGraphMode: function(graphMode) {
            AppDispatcher.handleViewAction({
                actionType: AppConstants.ActionTypes.SET_GRAPH_MODE,
                graphMode: graphMode
            });
        },

        setPlayerListSize: function(playerListSize) {
            AppDispatcher.handleViewAction({
                actionType: AppConstants.ActionTypes.SET_PLAYER_LIST_SIZE,
                playerListSize: playerListSize
            });
        },

        setControlsPosition: function(controlsPosition) {
            AppDispatcher.handleViewAction({
                actionType: AppConstants.ActionTypes.SET_CONTROLS_POSITION,
                controlsPosition: controlsPosition
            });
        },

        setLeftWidget: function(leftWidget) {
            AppDispatcher.handleViewAction({
                actionType: AppConstants.ActionTypes.SET_LEFT_WIDGET,
                leftWidget: leftWidget
            });
        }

    };

    return DisplaySettingsActions;
});