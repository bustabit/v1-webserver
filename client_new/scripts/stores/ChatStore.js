define([
  'lodash',
  'immutable',
  'lib/events',
  'constants/AppConstants',
  'dispatcher/AppDispatcher',
  'game-logic/clib'
], function(
  _,
  Immutable,
  Events,
  AppConstants,
  AppDispatcher,
  Clib
) {
  'use strict';

  var CHANGE_EVENT = 'change';

  /**
   * Local helper functions
   */
  function getLocalStorageChannels() {
    var arr = Clib.localOrDef('openedChannels', '["english"]');
    return JSON.parse(arr);
  }

  function createChannel(history) {
    return Immutable.Map({
      history: Immutable.List(history || []).reverse(),
      unreadCount: 0
    });
  }

  /**
   * Generates a fresh id and increments the counter.
   * @param {object} state - A mutable state object.
   */
  function freshMessageId(state) {
    var mid = state.get('nextMessageId');
    state.set('nextMessageId', mid+1);
    return mid;
  }

  var _state = Immutable.Map({
    /** Get the list from localStorage */
    openedChannels: getLocalStorageChannels(),

    /** Current opened tab on the chat **/
    currentChannel: Clib.localOrDef('currentChannel', 'english'),

    channels: Immutable.OrderedMap(getLocalStorageChannels().map(function(channelName) {
      return [channelName, createChannel()];
    })),

    /** How to display the bots on the chat:
     *    normal || greyed || none
     */
    botsDisplayMode: Clib.localOrDef('botsDisplayMode', 'normal'),

    /**
     * States of the chat:
     *  CONNECTING: The socket is establishing a connection.
     *  JOINING: The socket connection is established and we are connecting to a channel
     *  JOINED: Currently connected to a channel
     *  DISCONNECTED: Socket.io is trying to establish a connection
     */
    connectionState: 'CONNECTING',

    /** Username, if it is falsy the user is a guest **/
    username: null,

    /** Flag true if the user is a moderator or an admin **/
    isModerator: null,

    /**
     * Last event that affected this store. One of:
     *  <connection state>
     *  CHANGED_CHANNEL
     *  CHANGED_DISPLAY
     *  NEW_MSG_SELECTED
     *  NEW_MSG_HIDDEN
     *  NEW_MSG_CLIENT
     */
    lastEvent: null,

    /**
     * Next unassigned message id. This is used to give every message a unique
     * id. It's not important that this is backed by ids in any databse, ids
     * just have to be unique and constant.
     */
    nextMessageId: 0
  });

  /** Validate currentChannel **/
  var currentChannel = _state.get('currentChannel');
  var openedChannels = _state.get('openedChannels');
  if (currentChannel != 'english' && openedChannels.indexOf(currentChannel) == -1)
    _state = _state.set('currentChannel', 'english');

  /**
   * Manager of the channels for the ChatEngineStore
   */
  var ChatStore = _.extend({}, Events, {

    /**
     * Local Storage
     */
    updateStorage: function() {
      // Save the current channel and the opened channels on local storage
      localStorage['currentChannel'] = _state.get('currentChannel');
      localStorage['openedChannels'] = JSON.stringify(_state.get('openedChannels'));
    },

    /**
     * Event handling code
     */
    emitChange: function() {
      this.trigger(CHANGE_EVENT, _state);
    },

    addChangeListener: function(callback) {
      this.on(CHANGE_EVENT, callback);
    },

    removeChangeListener: function(callback) {
      this.off(CHANGE_EVENT, callback);
    },

    /**
     * Getter fors various parts of the store. These are pure functions that
     * return immutable data.
     */
    getState: function() {
      // make sure openedChannels is equal to the keyset of chanbels
      console.assert(_state.get('channels').has(_state.get('currentChannel')));
      return _state;
    },

    getSavedChannels: function() {
      return getLocalStorageChannels();
    },

    getConnectionState: function() {
      return _state.get('connectionState');
    },

    getCurrentChannel: function() {
      return _state.get('currentChannel');
    },

    setConnectionState: function(newConnectionState) {
      _state = _state
                 .set('connectionState', newConnectionState)
                 .set('lastEvent', newConnectionState);
      this.emitChange();
    },

    /** Set the visibility mode of the bots **/
    setBotsDisplayMode: function(displayMode) {
      localStorage['botsDisplayMode'] = displayMode;
      _state = _state
                 .set('botsDisplayMode', displayMode)
                 .set('lastEvent', 'CHANGED_DISPLALY');
      this.emitChange();
    },

    /**
     * If the channel is opened select it and return true
     * If is not opened return false
     * Clear the unread count when selecting the channel
     */
    selectChannel: function(channelName) {
      if (_state.get('channels').has(channelName)) {
        _state = _state
                   .set('currentChannel', channelName)
                   .setIn(['channels', channelName, 'unreadCount'], 0)
                   .set('lastEvent', 'CHANGED_CHANNEL');
        this.updateStorage();
        this.emitChange();
        return true;
      }
      return false;
    },

    closeCurrentChannel: function() {
      var oldChannels = _state.get('channels');
      var currentChannel = _state.get('currentChannel');
      console.assert(oldChannels.has(currentChannel));

      // Save the index of the selected channel.
      var oldIndex = oldChannels.keySeq().indexOf(currentChannel);

      // Update the channel map.
      _state = _state.deleteIn(['channels', currentChannel]);

      // The new selected channel will be the one before the current channel or
      // the first one.
      var newOpen    = _state.get('channels').keySeq();
      var newIndex   = Math.max(oldIndex - 1, 0);
      var newChannel = newOpen.get(newIndex);

      // Update open channel list
      _state = _state.set('openedChannels', newOpen.toArray());

      this.updateStorage();
      this.selectChannel(newChannel);
    },

    insertMessage: function(channelName, message, callback, event) {
      if (!_state.get('channels').has(channelName))
        return callback('CHANNEL_DOES_NOT_EXIST');

      _state = _state.withMutations(function(state) {
        // Assign a uniqe message id.
        message.mid = freshMessageId(state);

        // Insert the message and trim the history if it's too long.
        state.updateIn(['channels', channelName, 'history'], function(history) {
          history = history.push(message);
          while (history.size > AppConstants.Chat.MAX_LENGTH)
            history = history.shift();
          return history;
        });

        if (channelName === _state.get('currentChannel')) {
          state.set('lastEvent', event || 'NEW_MSG_SELECTED');
        } else {
          //If not the current channel add one to the unread count
          state.set('lastEvent', event || 'NEW_MSG_HIDDEN')
               .updateIn(['channels', channelName, 'unreadCount'],
                         function(c) { return c + 1; });
        }
      });

      this.emitChange();
      return callback(null);
    },

    insertMessageInCurrentChannel: function(message, event) {
      this.insertMessage(_state.get('currentChannel'), message, function() {}, event);
    },

    /** Add a client message, used for showing errors or messages on the chat **/
    insertClientMessage: function(message) {
      var msg = {
        time: Date.now(),
        type: 'client_message',
        message: message
      };

      this.insertMessageInCurrentChannel(msg, 'NEW_MSG_CLIENT');
    },

    /** Display a list of the users currently muted **/
    listMutedUsers: function(ignoredClientList) {

      var ignoredListMessage = '';
      var ignoredClientListArr = Object.keys(ignoredClientList);

      if(ignoredClientListArr.length === 0)
        ignoredListMessage = 'No users ignored';
      else
        ignoredClientListArr.forEach(function(key, index) {
          if(index !== 0)
            ignoredListMessage+= ' ,' + ignoredClientList[key].username;
          else
            ignoredListMessage+= ignoredClientList[key].username;
        });

      this.insertClientMessage(ignoredListMessage);
    },

    /** Process history after joining one or more channels. */
    joined: function(data) {
      _state = _state.withMutations(function(state) {
        var newChannels = data.channels;

        // If the mods channel is there put it before others.
        //
        // KUNGFUANT: Is this actually useful? It only does something when
        //   reopening the site. We could make the moderators channel always be
        //   the second one after english.
        if (newChannels.moderators && !state.get('channels').has('moderators'))
          state.setIn(['channels', 'moderators'], createChannel());

        // Add the history of the channels
        state.update('channels', function(channels) {
          return channels.withMutations(function(channels) {
            for (var channelName in newChannels) {
              var channelHistory = newChannels[channelName];

              for (var i in channelHistory)
                channelHistory[i].mid = freshMessageId(state);

              if (channels.has(channelName)) {
                // If the channel is already open, then simply overwrite the history.
                channels.setIn([channelName, 'history'], Immutable.List(channelHistory).reverse());
              } else {
                // If the channel is not yet open, create a new enty in the channel map.
                channels.set(channelName, createChannel(channelHistory));
              }
            }});
        });

        // If we set just one channel the channel will be selected as current channel
        var channelsArr = Object.keys(newChannels);
        if(channelsArr.length === 1)
          state.set('currentChannel', channelsArr[0]);

        state.merge({
          username: data.username,
          isModerator: data.moderator,
          connectionState: 'JOINED',
          lastEvent: 'JOINED',
          openedChannels: state.get('channels').keySeq().toArray()
        });
      });

      this.updateStorage();
      this.emitChange();
    }
  });

  /**
   * We avoid the flux boilerplate for any server created actions and rather
   * call the store handler functions directly from the socket handlers of the
   * chat engine. We use flux dispatching for user actions created by components
   * with the exception of joining and closing channels which also comes from
   * the chat engine.
   */
  AppDispatcher.register(function(payload) {
    var action = payload.action;

    switch(action.actionType) {
    case AppConstants.ActionTypes.CLIENT_MESSAGE:
      ChatStore.insertClientMessage(action.message);
      break;

    case AppConstants.ActionTypes.LIST_MUTED_USERS:
      ChatStore.listMutedUsers(action.ignoredClientList);
      break;

    case AppConstants.ActionTypes.SET_BOTS_DISPLAY_MODE:
      ChatStore.setBotsDisplayMode(action.displayMode);
      break;
    }

    return true; // No errors.
  });


  return ChatStore;
});
