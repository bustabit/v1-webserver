define([
    'react'
], function(
    React
) {
    var D = React.DOM;
    var ReactCSSTransitionGroup = React.createFactory(React.addons.CSSTransitionGroup);

    return React.createClass({
        displayName: 'ChatChannelSelector',

        propTypes: {
            selectedChannel: React.PropTypes.string.isRequired,
            selectChannel: React.PropTypes.func.isRequired,
            isMobileOrSmall: React.PropTypes.bool.isRequired,
            moderator: React.PropTypes.any //Not required because react takes null as not sent
        },

        getInitialState: function() {
            return {
                showingChans: false,
                showFlagHoverName: false,
                popoverPosition: { x: 0, y: 0 }
            }
        },

        _toggleShowingChans: function() {
            this.setState({ showingChans: !this.state.showingChans, showFlagHoverName: false });
        },

        _onFlagOver: function(channelName) {
            var self = this;
            return function(e) {
                if(self.state.showingChans)
                    self.setState({
                        showFlagHoverName: channelName,
                        popoverPosition: {
                            x: e.pageX,
                            y: e.pageY
                        }
                    });
            }
        },

        _onFlagOut: function() {
            this.setState({ showFlagHoverName: false });
        },

        render: function() {
            var self = this;

            var rowLength = this.props.isMobileOrSmall? 9 : 11;

            var chans = [
                'arabic', 'armenian', 'basque', 'bengali', 'bosnian', 'bulgarian',
                'chinese', 'croatian', 'czech', 'danish', 'dutch', 'english',
                'estonian', 'farsi', 'finnish', 'french', 'german', 'greek',
                'hebrew', 'hindi', 'hungarian', 'indonesian', 'italian', 'korean',
                'latvian', 'lithuanian', 'maltese', 'norwegian', 'polish',
                'portuguese', 'romanian', 'russian', 'serbian', 'slovak',
                'slovenian', 'spanish', 'swedish', 'thai', 'turkish',
                'ukrainian', 'vietnamese'
            ];

            // Always add spam channel first.
            chans.unshift('spam');

            if(this.props.moderator)
                chans.push('moderators');

            var chansRows = [];
            for(var i = 0, e = 0, length = chans.length; i < length; i += rowLength, e++ )
                chansRows[e] = chans.slice(i, i+rowLength);

            //Give the arrays of names of certain size create an array of divs(flags rows) which each one contains an array of images
            var flagRows = [];
            chansRows.forEach(function(row, rowIndex) {
                flagRows[rowIndex] = D.div({ className: 'flags-row', key: 'row-' + rowIndex },
                    row.map(function(channel, index) {
                        return D.img({
                                src: 'img/flags/' + channel + '.png',
                                className: 'flags-flag',
                                onClick: self.props.selectChannel(channel),
                                key: 'flag-' + index,
                                onMouseOver: self._onFlagOver(channel),
                                onMouseOut: self._onFlagOut
                            })
                    })
                )
            });

            return D.div({ id: 'chat-channel-selector', className: 'noselect', onClick: this._toggleShowingChans },
                D.img({ src: 'img/flags/' + this.props.selectedChannel + '.png' }),
                D.i({ className: this.state.showingChans? 'fa fa-caret-down' : 'fa fa-caret-up' }),
                ReactCSSTransitionGroup({
                    key: 'flags-cont',
                    transitionName: 'flags',
                    transitionEnterTimeout: 400,
                    transitionLeaveTimeout: 200
                }, this.state.showingChans?
                       D.div({ className: 'flags-container' },
                           flagRows
                       ) : null
                ),
                this.state.showFlagHoverName ? D.span({ className: 'flags-popover', style: { top: this.state.popoverPosition.y + 28, left: this.state.popoverPosition.x }}, this.state.showFlagHoverName) : null
            );
        }

    });
});