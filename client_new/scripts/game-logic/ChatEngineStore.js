define([
    'socketio',
    'lib/events',
    'game-logic/clib',
    'stores/ChatStore',
    'constants/AppConstants',
    'dispatcher/AppDispatcher',
    'stores/GameSettingsStore'
], function(
    io,
    Events,
    Clib,
    ChatStore,
    AppConstants,
    AppDispatcher,
    GameSettingsStore
) {

    var CHANGE_EVENT = 'change';

    function Chat() {
        var self = this;

        /**
         * Chat inherits from BackBone events:
         * http://backbonejs.org/#Events
         * which means it has events like .on, off, .trigger, .once, .listenTo, .stopListening
         */
        _.extend(this, Events);

        self.ws = io(AppConstants.Engine.CHAT_HOST);

        /**
         * Event called every time we receive a chat message
         * @param {object} resp - JSON payload
         * @param {string} time - Time when the message was sent
         * @param {string} type - The 'command': say, mute, error, info
         * @param {username} string - The username of who sent it
         * @param {role} string - admin, moderator, user
         * @param {message} string - Da message
         */
        self.ws.on('msg', function(data) {

            ChatStore.insertMessage(data.channelName, data, function(err) {
                if(err) {
                    if(err === 'CHANNEL_DOES_NOT_EXIST')
                        return console.error('[Chat] Received a message from a channel we are not listening:', data.channelName);
                    return console.error('[Chat] ', err);
                }

                //If @username in message ring
                var username = ChatStore.getState().get('username');
                var r = new RegExp('@' + username + '(?:$|[^a-z0-9_\-])', 'i');
                var ignored = GameSettingsStore.getIgnoredClientList().hasOwnProperty(data.username.toLowerCase())
                if (!ignored && data.type === 'say' && data.username !== username && r.test(data.message))
                    new Audio('/sounds/gong.mp3').play();

                self.trigger('msg', data);
            });
        });

        /** Socket io errors */
        self.ws.on('error', function(x) {
            console.log('on error: ', x);
            self.trigger('error', x);
        });

        /** Server Errors */
        self.ws.on('err', function(err) {
            console.error('Server sent us the error: ', err);
        });

        /** Socket io is connected to the server **/
        self.ws.on('connect', function() {
            ChatStore.setConnectionState('JOINING');
            self.ws.emit('join', ChatStore.getSavedChannels(), self.onJoin.bind(self));
            self.trigger('joining');
        });

        self.ws.on('disconnect', function(data) {
            ChatStore.setConnectionState('DISCONNECTED');
            self.trigger('disconnected');
        });
    }


    Chat.prototype = {

        onJoin: function(err, data) {
            var self = this;

            if(err)
                return console.error(err);

            ChatStore.joined(data);
            self.trigger('joined');
        },

        /** Join to a different channel **/
        joinChannel: function(channelName) {

            //If the channel is already opened just change it
            if (ChatStore.selectChannel(channelName))
                return this.trigger('channel-changed');

            //Do not attempt to join a channel is we are not connected already
            if (ChatStore.getConnectionState() !== 'JOINED')
                return;

            //If not connect to it
            this.ws.emit('join', channelName, this.onJoin.bind(this));
            ChatStore.setConnectionState('JOINING');
            this.trigger('joining');
        },

        /** Close the current opened channel **/
        closeCurrentChannel: function() {
            var self = this;

            //If we are connected leave the channel
            if (ChatStore.getConnectionState() === 'JOINED') {
                self.ws.emit('leave', ChatStore.getCurrentChannel(), function(err) {
                    if (err) {
                        return console.error('[leave] ', err);
                    }

                    ChatStore.closeCurrentChannel();
                    self.trigger('channel-closed');
                });

            //If we are not connected just erase the channel from the channel manager
            } else {
                ChatStore.closeCurrentChannel();
                self.trigger('channel-closed');
            }

        },

        /**
         * Sends chat message
         * @param {string} msg - String containing the message, should be longer than 1 and shorter than 500.
         * @param {bool} isBot - Flag to tell the server than this message is from a bot
         */
        say: function(msg, isBot) {
            var self = this;
            console.assert(msg.length >= 1 && msg.length < 500);
            self.ws.emit('say', msg, ChatStore.getCurrentChannel(), isBot, function(err) {
                if(err) {
                    switch(err) {
                        case 'INVALID_MUTE_COMMAND':
                            ChatStore.insertMessageInCurrentChannel(
                              buildChatError('Invalid mute command'));
                            break;

                        case 'USER_DOES_NOT_EXIST':
                            ChatStore.insertMessageInCurrentChannel(
                              buildChatError('Username does not exist'));
                            break;

                        case 'NOT_A_MODERATOR':
                            ChatStore.insertMessageInCurrentChannel(
                              buildChatError('Username does not exist'));
                            break;

                        case 'INVALID_UNMUTE_COMMAND':
                            ChatStore.insertMessageInCurrentChannel(
                              buildChatError('Invalid unmute command'));
                            break;

                        case 'USER_NOT_MUTED':
                            ChatStore.insertMessageInCurrentChannel(
                              buildChatError('User not muted'));
                            break;

                        case 'UNKNOWN_COMMAND':
                            ChatStore.insertMessageInCurrentChannel(
                              buildChatError('Unknown command'));
                            break;

                        default:
                            console.error('[say] ', err);
                            break;
                    }
                    self.trigger('say-error');
                }
            });
        }
    };


    var ChatSingleton = new Chat();

    /**
     * Here is the other virtual part of the store:
     * The actions created by flux views are converted
     * to calls to the engine which will case changes there
     * and they will be reflected here through the event listener
     */
    AppDispatcher.register(function(payload) {
        var action = payload.action;

        switch(action.actionType) {

            case AppConstants.ActionTypes.SAY_CHAT:
                ChatSingleton.say(action.msg);
                break;

            case AppConstants.ActionTypes.JOIN_CHANNEL:
                ChatSingleton.joinChannel(action.channelName);
                break;

            case AppConstants.ActionTypes.CLOSE_CURRENT_CHANNEL:
                ChatSingleton.closeCurrentChannel();
                break;
        }

        return true; // No errors. Needed by promise in Dispatcher.
    });

    return ChatSingleton;
});

function buildChatError(message) {
    return {
        date: new Date(),
        type: 'error',
        message: message
    }
}