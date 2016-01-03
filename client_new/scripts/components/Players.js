define([
    'react',
    'game-logic/clib',
    'lodash',
    'stores/GameSettingsStore',
    'game-logic/GameEngineStore',
    'classnames'
], function(
    React,
    Clib,
    _,
    GameSettingsStore,
    Engine,
    CX
){

    var D = React.DOM;

    function calcProfit(bet, stoppedAt) {
        return ((stoppedAt - 100) * bet)/100;
    }

    function getState() {
      var state = GameSettingsStore.getState();
      state.engine = Engine;
      return state;
    }

    var PlayingEntryClass = React.createClass({
      displayName: 'PlayingEntry',
      mixins: [React.addons.PureRenderMixin],

      propTypes: {
        gameState: React.PropTypes.string.isRequired,
        clientUsername: React.PropTypes.string,

        username: React.PropTypes.string.isRequired,
        bet: React.PropTypes.number,
        bonusPercentage: React.PropTypes.string.isRequired
      },

      render: function() {
        var bonusClass = (this.props.gameState === 'IN_PROGRESS')? 'bonus-projection' : '';
        var classes = CX({
            'user-playing': true,
            'me': this.props.clientUsername === this.props.username
        });

        return D.tr({ className: classes },
            D.td(null, D.a({ href: '/user/' + this.props.username,
                    target: '_blank'
                },
                this.props.username)),
            D.td(null, '-'),
            D.td(null,
                this.props.bet ? Clib.formatSatoshis(this.props.bet, 0) : '?'
            ),
            D.td({ className: bonusClass }, this.props.bonusPercentage),
            D.td(null, '-')
        );
      }
    });
    var PlayingEntry = React.createFactory(PlayingEntryClass);

    var CashedEntryClass = React.createClass({
      displayName: 'CashedEntry',
      mixins: [React.addons.PureRenderMixin],

      propTypes: {
        gameState: React.PropTypes.string.isRequired,
        clientUsername: React.PropTypes.string,

        username: React.PropTypes.string.isRequired,
        bet: React.PropTypes.number.isRequired,
        bonusPercentage: React.PropTypes.string.isRequired,
        stoppedAt: React.PropTypes.number.isRequired
      },

      render: function() {
        var bonusClass = (this.props.gameState === 'IN_PROGRESS')? 'bonus-projection' : '';
        var profit = calcProfit(this.props.bet, this.props.stoppedAt);
        var classes = CX({
          'user-cashed': true,
          'me': this.props.clientUsername === this.props.username
        });

        return D.tr({ className: classes, key: this.props.username },
            D.td(null, D.a({ href: '/user/' + this.props.username,
                    target: '_blank'
                },
                this.props.username)),
            D.td(null, this.props.stoppedAt/100 + 'x'),
            D.td(null, Clib.formatSatoshis(this.props.bet, 0)),
            D.td({ className: bonusClass }, this.props.bonusPercentage),
            D.td(null, Clib.formatSatoshis(profit))
        );
      }
    });
    var CashedEntry = React.createFactory(CashedEntryClass);

    return React.createClass({
        displayName: 'usersPlaying',

        getInitialState: function () {
            return getState();
        },

        componentDidMount: function() {
            Engine.on({
                joined: this._onChange,
                disconnected: this._onChange,
                game_started: this._onChange,
                game_crash: this._onChange,
                game_starting: this._onChange,
                player_bet: this._onChange,
                cashed_out: this._onChange
            });
            //Not using all events but the store does not emits a lot
            GameSettingsStore.addChangeListener(this._onChange);
        },

        componentWillUnmount: function() {
            Engine.off({
                joined: this._onChange,
                disconnected: this._onChange,
                game_started: this._onChange,
                game_crash: this._onChange,
                game_starting: this._onChange,
                player_bet: this._onChange,
                cashed_out: this._onChange
            });
            GameSettingsStore.removeChangeListener(this._onChange);
        },

        _animRequest: null,
        _onChange: function() {
            // Already scheduled an update.
            if (this._animRequest) return;

            // Schedule a new update of this component.
            var self = this;
            this._animRequest =
            window.requestAnimationFrame(function() {
                if(self.isMounted())
                  self.setState(getState());
            });
        },

        render: function() {
            // Reset the animation request id when rendering.
            this._animRequest = null;

            var self = this;

            var usersWonCashed = [];
            var usersLostPlaying = [];

            var trUsersWonCashed;
            var trUsersLostPlaying;

            var tBody;

            var game = self.state.engine;


            if(game.connectionState ==! 'JOINED')
                return renderWrapper(null);

            /** Separate and sort the users depending on the game state **/
            if (game.gameState === 'STARTING') {

                //The list is already ordered by engine given an index
                _.forEach(self.state.engine.joined, function(player) {
                    var bet = null; // can be null
                    if (player === self.state.engine.username)
                        bet = self.state.engine.nextBetAmount;
                    else if (usersLostPlaying.length > self.state.playerListSize)
                        return;
                    usersLostPlaying.push({ username: player, bet: bet });
                });

            //IN_PROGRESS || ENDED
            } else {

                var plays = [];
                _.forEach(game.playerInfo, function (play) {
                    plays.push(play);
                });

                plays.sort(function(a, b) {
                    var r = b.bet - a.bet;
                    if (r !== 0) return r;
                    return a.username < b.username ? 1 : -1;
                });

                _.forEach(plays, function (play, index) {
                    if (play.username === self.state.engine.username ||
                        index <= self.state.playerListSize) {
                    if (play.stopped_at)
                        usersWonCashed.push(play);
                    else
                        usersLostPlaying.push(play);
                  }
                });

                usersWonCashed.sort(function(a, b) {
                    var r = b.stopped_at - a.stopped_at;
                    if (r !== 0) return r;
                    return a.username < b.username ? 1 : -1;
                });

            }

            /** Create the rows for the table **/

            //Users Playing and users cashed
            if(game.gameState === 'IN_PROGRESS' || game.gameState === 'STARTING') {
                var i, length, user, bonus;

                trUsersLostPlaying = [];
                for(i=0, length = usersLostPlaying.length; i < length; i++) {
                  user = usersLostPlaying[i];
                  bonus =
                    game.gameState === 'STARTING'? '-' :
                    user.bonus ? Clib.formatDecimals((user.bonus*100/user.bet), 2) + '%' :
                      '0%';

                  trUsersLostPlaying.push(PlayingEntry({
                    key: user.username,
                    gameState: game.gameState,
                    clientUsername: game.username,
                    username: user.username,
                    bet: user.bet,
                    bonusPercentage: bonus
                  }));
                }

                trUsersWonCashed = [];
                for (i=0, length = usersWonCashed.length; i < length; i++) {
                  user = usersWonCashed[i];
                  bonus =
                    game.gameState === 'STARTING'? '-' :
                    user.bonus ? Clib.formatDecimals((user.bonus*100/user.bet), 2) + '%' :
                      '0%';

                  trUsersWonCashed.push(CashedEntry({
                    key: user.username,
                    gameState: game.gameState,
                    clientUsername: game.username,
                    username: user.username,
                    bet: user.bet,
                    bonusPercentage: bonus,
                    stoppedAt: user.stopped_at
                  }));
                }

                tBody = D.tbody({ className: '' },
                    trUsersLostPlaying,
                    trUsersWonCashed
                );

                //Users Lost and users Won
            } else if(game.gameState === 'ENDED') {

                trUsersLostPlaying = usersLostPlaying.map(function(entry, i) {
                    var bet = entry.bet;
                    var bonus = entry.bonus;
                    var profit = -bet;

                    if (bonus) {
                        profit = Clib.formatSatoshis(profit + bonus);
                        bonus = Clib.formatDecimals(bonus*100/bet, 2)+'%';
                    } else {
                        profit = Clib.formatSatoshis(profit);
                        bonus = '0%';
                    }

                    var classes = CX({
                        'user-lost': true,
                        'me': self.state.engine.username === entry.username
                    });

                    return D.tr({ className: classes, key: entry.username },
                        D.td(null, D.a({ href: '/user/' + entry.username,
                                target: '_blank'
                            },
                            entry.username)),
                        D.td(null, '-'),
                        D.td(null, Clib.formatSatoshis(entry.bet, 0)),
                        D.td(null, bonus),
                        D.td(null, profit)
                    );
                });

                trUsersWonCashed = usersWonCashed.map(function(entry, i) {
                    var bet = entry.bet;
                    var bonus = entry.bonus;
                    var stopped = entry.stopped_at;
                    var profit = bet * (stopped - 100) / 100;

                    if (bonus) {
                        profit = Clib.formatSatoshis(profit + bonus);
                        bonus = Clib.formatDecimals(bonus*100/bet, 2)+'%';
                    } else {
                        profit = Clib.formatSatoshis(profit);
                        bonus = '0%';
                    }

                    var classes = CX({
                        'user-won': true,
                        'me': self.state.engine.username === entry.username
                    });

                    return D.tr(
                        { className: classes, key: entry.username },
                        D.td(null, D.a({
                                href: '/user/' + entry.username,
                                target: '_blank'
                            },
                            entry.username)),
                        D.td(null, stopped / 100, 'x'),
                        D.td(null, Clib.formatSatoshis(bet, 0)),
                        D.td(null, bonus),
                        D.td(null, profit)
                    );
                });

                tBody = D.tbody({ className: '' },
                    trUsersLostPlaying,
                    trUsersWonCashed
                );
            }

            return renderWrapper(tBody);


            function renderWrapper(body) {
                return D.div({ id: 'players-container' },
                    D.div({ className: 'header-bg' }),
                    D.div({ className: 'table-inner' },
                        D.table({ className: 'users-playing' },
                            D.thead(null,
                                D.tr(null,
                                    D.th(null, D.div({ className: 'th-inner' }, 'User')),
                                    D.th(null, D.div({ className: 'th-inner' }, '@')),
                                    D.th(null, D.div({ className: 'th-inner' }, 'Bet')),
                                    D.th(null, D.div({ className: 'th-inner' }, 'Bonus')),
                                    D.th(null, D.div({ className: 'th-inner' }, 'Profit'))
                                )
                            ),
                            tBody
                        )
                    )
                );
            }

        }

    });

});