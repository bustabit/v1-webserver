define([
    'react',
    'lodash',
    'game-logic/clib',
    'game-logic/GameEngineStore',
    'game-logic/stateLib'
], function(
    React,
    _,
    Clib,
    Engine,
    StateLib
){
    var D = React.DOM;

    //The state is set on the component to to allow react batch renders
    function getState(){
      return _.assign({
        connectionState: Engine.connectionState,
        gameState: Engine.gameState,
        currentlyPlaying: StateLib.currentlyPlaying(Engine)
      }, calculatePlayingPercentages(Engine));
    }

    return React.createClass({
        displayName: 'BetBar',
        mixins: [React.addons.PureRenderMixin],

        getInitialState: function () {
            return getState();
        },

        componentDidMount: function() {
            Engine.on({
                joined: this.onChange,
                disconnected: this.onChange,
                game_started: this._onChange,
                game_crash: this._onChange,
                game_starting: this._onChange,
                player_bet: this._onChange,
                cashed_out: this._onChange
            });
        },

        componentWillUnmount: function() {
            Engine.off({
                game_started: this._onChange,
                game_crash: this._onChange,
                game_starting: this._onChange,
                player_bet: this._onChange,
                cashed_out: this._onChange
            });
        },

        _animRequest: null,
        _onChange: function() {
            // Already scheduled an update.
            if (this._animRequest) return;

            // Schedule a new update of this component.
            var self = this;
            this._animRequest = window.requestAnimationFrame(function() {
              // Reset the animation request id when rendering.
              self._animRequest = null;

              // Check if its mounted because when Game view receives the disconnect event from EngineVirtualStore unmounts all views
              // and the views unregister their events before the event dispatcher dispatch them with the disconnect event
              if (self.isMounted())
                self.setState(getState());
            });
        },

        render: function() {
            //If the Engine is not connected or the game is starting
            if(this.state.connectionState !== 'JOINED' || this.state.gameState === 'STARTING')
             return D.div({ className: 'bet-bar-starting' });

            var playingLostClass, cashedWonClass, mePlayingClass;
            if(this.state.gameState === 'ENDED') {
                playingLostClass = 'bet-bar-lost';
                cashedWonClass = 'bet-bar-won';
                mePlayingClass = this.state.currentlyPlaying?  'bet-bar-me-lost': 'bet-bar-me-won';
            } else {
                playingLostClass = 'bet-bar-playing';
                cashedWonClass = 'bet-bar-cashed';
                mePlayingClass = this.state.currentlyPlaying?  'bet-bar-me-playing': 'bet-bar-me-cashed';
            }

            var bars = [];
            if (this.state.cashedWon > 0)      bars.push(D.div({ key: 0, className: cashedWonClass,   style: { width: this.state.cashedWon + '%' } }));
            if (this.state.me > 0)             bars.push(D.div({ key: 1, className: mePlayingClass,   style: { width: this.state.me + '%' } }));
            if (this.state.cashedWonAfter > 0) bars.push(D.div({ key: 2, className: cashedWonClass,   style: { width: this.state.cashedWonAfter + '%' } }));
            if (this.state.playingLost > 0)    bars.push(D.div({ key: 3, className: playingLostClass, style: { width: this.state.playingLost + '%' } }));

            return D.div({ className: 'bet-bar-container' }, bars);
        }

    });

    function calculatePlayingPercentages(engine) {
        /**
         * bitsPlaying: The total amount of bits playing(not cashed) minus your qty if you are playing
         * bitsCashedOut: The total amount of bits cashed before you if you are playing, if you are not its the total cashed out amount minus your qty
         * bitsCashedOutAfterMe: If you are playing...
         * myBet: guess!
         */

        //If there are no players
        var players = engine.playerInfo || {};
        if(Object.getOwnPropertyNames(players).length <= 0) {
            return {
                playingLost: 0,
                cashedWon: 0,
                cashedWonAfter: 0,
                me: 0
            };
        }

        var bitsPlaying = 0, bitsCashedOut = 0, bitsCashedOutAfterMe = 0;

        var currentPlay = StateLib.currentPlay(engine);

        var myBet = currentPlay? currentPlay.bet: 0;
        var myStop = (currentPlay && currentPlay.stopped_at)? currentPlay.stopped_at: 0;

        _.forEach(players,function(player, username) {
            if(username !== engine.username)
                if(player.stopped_at) {
                    if(player.stopped_at > myStop)
                        bitsCashedOutAfterMe += player.bet;
                    else
                        bitsCashedOut += player.bet;

                } else {
                    bitsPlaying+= player.bet;
                }
        });

        var totalAmountPlaying = bitsPlaying + bitsCashedOut + bitsCashedOutAfterMe + myBet;
        var cashedWon      = Math.round(5 * bitsCashedOut / totalAmountPlaying * 100) / 5;
        var me             = Math.round(5 * myBet / totalAmountPlaying * 100) / 5;
        var cashedWonAfter = Math.round(5 * bitsCashedOutAfterMe / totalAmountPlaying * 100) / 5;
        var playingLost    = Math.round(5 * (100 - cashedWon - me - cashedWonAfter)) / 5;

        return {
          cashedWon: cashedWon,
          me: me,
          cashedWonAfter: cashedWonAfter,
          playingLost: playingLost
        };
    }
});
