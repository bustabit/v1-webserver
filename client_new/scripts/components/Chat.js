define([
    'react',
    'game-logic/clib',
    'autolinker',
    'actions/ChatActions',
    'stores/GameSettingsStore',
    'stores/ChatStore',
    'components/ChatChannelSelector'
], function(
    React,
    Clib,
    Autolinker,
    ChatActions,
    GameSettingsStore,
    ChatStore,
    ChatChannelSelectorClass
){
    // Overrides Autolinker.js' @username handler to instead link to
    // user profile page.
    var replaceUsernameMentions = function(autolinker, match) {
      // Use default handler for non-twitter links
      if (match.getType() !== 'twitter') return true;

      var username = match.getTwitterHandle();
      return '<a href="/user/' + username +'" target="_blank">@' + username + '</a>';
    };

    var escapeHTML = (function() {
      var entityMap = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': '&quot;',
        "'": '&#39;'
      };

      return function(str) {
        return String(str).replace(/[&<>"']/g, function (s) {
          return entityMap[s];
        });
      };
    })();

    var D = React.DOM;

    var ChatChannelSelector = React.createFactory(ChatChannelSelectorClass);

    /* Constants */
    var SCROLL_OFFSET = 120;

    function getState() {
      var state = ChatStore.getState().toObject();
      state.ignoredClientList = GameSettingsStore.getIgnoredClientList();
      state.history = state.channels.getIn([state.currentChannel, 'history']).toArray();
      return state;
    }

    return React.createClass({
        displayName: 'Chat',

        propTypes: {
            isMobileOrSmall: React.PropTypes.bool.isRequired
        },

        getInitialState: function () {
            this.listLength = 0; // Avoid scrolls down if a render is not caused by length chat change
            return getState();
        },

        componentDidMount: function() {
            ChatStore.addChangeListener(this._onChange); //Use all events
            GameSettingsStore.addChangeListener(this._onChange); //Not using all events but the store does not emits a lot

            //If messages are rendered scroll down to the bottom
            if(this.refs.messages) {
                var msgsNode = this.refs.messages.getDOMNode();
                msgsNode.scrollTop = msgsNode.scrollHeight;
            }
        },

        componentWillUnmount: function() {
            ChatStore.removeChangeListener(this._onChange);
            GameSettingsStore.removeChangeListener(this._onChange);
        },

        /** If the length of the chat changed and the scroll position is near bottom scroll to the bottom **/
        componentDidUpdate: function(prevProps, prevState) {

            //If the chat is not connected do nothing
            if (this.state.connectionState !== 'JOINED')
                return;

            //On join or channel change scroll to the bottom
            if (this.state.lastEvent === 'JOINED' || this.state.lastEvent === 'CHANGED_CHANNEL') {
                var msgsNode = this.refs.messages.getDOMNode();
                msgsNode.scrollTop = msgsNode.scrollHeight;

            //If there is a new message scroll to the bottom if is near to it
            } else if (this.state.history.length != this.listLength) {

                this.listLength = this.state.history.length;

                //If messages are rendered scroll down
                if(this.refs.messages) {
                    var msgsBox = this.refs.messages.getDOMNode();
                    var scrollBottom = msgsBox.scrollHeight-msgsBox.offsetHeight-msgsBox.scrollTop;

                    if(scrollBottom < SCROLL_OFFSET)
                        msgsBox.scrollTop = msgsBox.scrollHeight;
                }
            }
        },

        _onChange: function() {
            if (this.isMounted())
                this.setState(getState());
        },

        _sendMessage: function(e) {
            if(e.keyCode == 13) {
                var msg = e.target.value;
                msg = msg.trim();

                //If not command was done is a message(or command) to the server
                if(!this._doCommand(msg)){
                    if(msg.length >= 1 && msg.length < 500) {
                        this._say(msg);
                        e.target.value = '';
                    }

                //If a command was done erase the command text
                } else {
                    e.target.value = '';
                }
            }
        },

        //Returns true if a command was done, false if not
        _doCommand: function(msg) {

            //Check if is command
            var cmdReg = /^\/([a-zA-z]*)\s*(.*)$/;
            var cmdMatch = msg.match(cmdReg);

            if(!cmdMatch)
                return;

            var cmd  = cmdMatch[1];
            var rest = cmdMatch[2];

            switch(cmd) {
                case 'ignore':

                    if (this.state.username === rest) {
                        ChatActions.showClientMessage('Cant ignore yourself');

                    } else if(Clib.isInvalidUsername(rest)) {
                        ChatActions.showClientMessage('Invalid Username');

                    } else if(!this.state.ignoredClientList.hasOwnProperty(rest.toLowerCase())) {
                        ChatActions.ignoreUser(rest);
                        ChatActions.showClientMessage('User ' + rest + ' ignored');

                    } else
                        ChatActions.showClientMessage('User ' + rest + ' was already ignored');

                    return true;

                case 'unignore':

                    if(Clib.isInvalidUsername(rest)) {
                        ChatActions.showClientMessage('Invalid Username');

                    } else if(this.state.ignoredClientList.hasOwnProperty(rest.toLowerCase())) {

                        ChatActions.approveUser(rest);
                        ChatActions.showClientMessage('User ' + rest + ' approved');

                    } else
                        ChatActions.showClientMessage('User ' + rest + ' was already approved');

                    return true;

                case 'ignored':
                    ChatActions.listMutedUsers(this.state.ignoredClientList);
                    return true;

                default:
                    return false;
            }
        },

        _say: function(msg) {
            ChatActions.say(msg);
        },

        _selectChannel: function(channelName) {
            return function() {
                ChatActions.selectChannel(channelName);
            };
        },

        _closeChannel: function() {
            ChatActions.closeCurrentChannel();
        },

        render: function() {
            var self = this;
            var state = this.state;

            //Messages div
            var chatMessagesContainer;

            /** Chat input **/
            var chatInput;
            var chatInputPlaceholder;
            var chatInputOnKeyDown = null;
            var chatInputDisabled = false;
            var chatInputClass = 'chat-input';

            switch (state.connectionState) {

                //Render loading spinner on chat container and render 'connecting' on the chat input
                case 'CONNECTING':

                    //Spinner
                    chatMessagesContainer = D.div({ className: 'loading-container' });//Loading spinner is added by css as background

                    //Input
                    chatInputPlaceholder = 'Connecting...';
                    chatInputDisabled = true;

                    break;

                //Render loading spinner on chat container and render 'joining channel' on the chat input
                case 'JOINING':

                    //Spinner
                    chatMessagesContainer = D.div({ className: 'loading-container' });//Loading spinner is added by css as background

                    //Input
                    chatInputPlaceholder = 'Joining...';
                    chatInputDisabled = true;

                    break;

                //Render everything
                case 'JOINED':

                    chatMessagesContainer = renderCurrentChannelMessages();

                    //If user is logged
                    if (state.username) {
                        chatInputPlaceholder = 'Type here...';
                        chatInputOnKeyDown = this._sendMessage;

                    //If user is not logged
                    } else {
                        chatInputPlaceholder = 'Login to chat...';
                        chatInputDisabled = true;
                    }

                    break;

                //Render connection lost on the message container and render 'connection lost' on the chat input
                case 'DISCONNECTED':

                    chatMessagesContainer = renderCurrentChannelMessages();

                    //Input
                    chatInputPlaceholder = 'Not connected...';
                    chatInputDisabled = true;
                    chatInputClass += ' disconnected';

                    break;
            }

            //Render current channel messages
            function renderCurrentChannelMessages() {
                //Render the messages of the current channel
                var messages = [];
                for (var i = self.state.history.length-1; i >= 0; i--)
                    messages.push(self._renderMessage(self.state.history[i], i));

                return D.ul({ className: 'messages', ref: 'messages' },
                    messages
                );
            }

            //Text input
            chatInput = D.input( //Input is not binded due to slowness on some browsers
                { className: chatInputClass,
                    onKeyDown: chatInputOnKeyDown,
                    maxLength: '500',
                    ref: 'input',
                    placeholder: chatInputPlaceholder,
                    disabled: chatInputDisabled
                }
            );

            /**
             * Tabs panel
             *
             * Show them always except when the engine is connecting because it does not have history in that moment
             */
            var channelTabs = [];
            if (state.connectionState !== 'CONNECTING') {
              state.channels.forEach(function(channelObject, channelName) {
                channelObject = channelObject.toObject();
                var isCurrentChannel = state.currentChannel === channelName;
                var isClosable = isCurrentChannel &&
                                 channelName != 'english' &&
                                 channelName != 'moderators';
                var hasUnread = channelObject.unreadCount != 0;

                var onClickHandler =
                      isClosable? self._closeChannel :
                      isCurrentChannel? null :
                      self._selectChannel(channelName);

                channelTabs.push(D.div({ className: 'tab', key: channelName, onClick: onClickHandler },
                    isClosable? D.i({ className: 'fa fa-times close-channel' }) : null,
                    isCurrentChannel? D.div({ className: 'selected-border' }) : null,
                    hasUnread? D.span({ className: 'unread-counter' }, channelObject.unreadCount) : null,
                    D.img({
                        src: 'img/flags/' + channelName + '.png'
                    })
                ));
              });
            }

            return D.div({ id: 'chat' },

                D.div({ className: 'tabs-container' },
                    D.div({ className: 'tabs-scroller' },
                        channelTabs
                    )
                ),

                chatMessagesContainer,

                D.div({ className: 'chat-input-container' },
                    chatInput,
                    ChatChannelSelector({
                        selectChannel: this._selectChannel,
                        selectedChannel: state.currentChannel,
                        isMobileOrSmall: this.props.isMobileOrSmall,
                        moderator: state.isModerator
                    })
                ),
                D.div({ className: 'spinner-pre-loader' }) //Pre load the image
            );
        },

        _renderMessage: function(message, index) {

        var pri = 'msg-chat-message';
        switch(message.type) {
            case 'say':

                //If the user is in the ignored client list do not render the message
                if (this.state.ignoredClientList.hasOwnProperty(message.username.toLowerCase()))
                    return;

                //Messages starting with '!' are considered as bot except those ones for me
                if(message.bot || /^!/.test(message.message)) {

                    //If we are ignoring bots and the message is from a bot do not render the message
                    if (this.state.botsDisplayMode === 'none')
                        return;

                    pri += ' msg-bot';

                    if (this.state.botsDisplayMode === 'greyed')
                        pri += ' bot-greyed';
                }

                if (message.role === 'admin')
                    pri += ' msg-admin-message';

                var username = this.state.username;

                var r = new RegExp('@' + username + '(?:$|[^a-z0-9_\-])', 'i');
                if (username && message.username != username && r.test(message.message)) {
                    pri += ' msg-highlight-message';
                }

                var msgDate = new Date(message.date);
                var timeString = msgDate.getHours() + ':' + ((msgDate.getMinutes() < 10 )? ('0' + msgDate.getMinutes()) : msgDate.getMinutes()) + ' ';

                return D.li({ className: pri , key: 'msg' + index },
                    D.span({
                            className: 'time-stamp'
                        },
                        timeString
                    ),
                    D.a({
                            href: '/user/' + message.username,
                            target: '_blank'
                        },
                        message.username, ':'
                    ),
                    ' ',
                    D.span({
                        className: 'msg-body',
                        dangerouslySetInnerHTML: {
                            __html: Autolinker.link(
                                escapeHTML(message.message),
                                { truncate: 50, replaceFn: replaceUsernameMentions }
                            )
                        }
                    })
                );
            case 'mute':
                pri = 'msg-mute-message';
                return D.li({ className: pri , key: 'msg' + index },
                    D.a({ href: '/user/' + message.moderator,
                            target: '_blank'
                        },
                        '*** <'+message.moderator+'>'),
                    message.shadow ? ' shadow muted ' : ' muted ',
                    D.a({ href: '/user/' + message.username,
                            target: '_blank'
                        },
                        '<'+message.username+'>'),
                    ' for ' + message.timespec);
            case 'unmute':
                pri = 'msg-mute-message';
                return D.li({ className: pri , key: 'msg' + index },
                    D.a({ href: '/user/' + message.moderator,
                            target: '_blank'
                        },
                        '*** <'+message.moderator+'>'),
                    message.shadow ? ' shadow unmuted ' : ' unmuted ',
                    D.a({ href: '/user/' + message.username,
                            target: '_blank'
                        },
                        '<'+message.username+'>')
                );
            case 'error':
            case 'info':
            case 'client_message':
                pri = 'msg-info-message';
                return D.li({ className: pri, key: 'msg' + index },
                    D.span(null, ' *** ' + message.message));
                break;
            default:
                break;
        }
    }
});

});