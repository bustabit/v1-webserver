define([
    'react',
    'react-dom',
    'lodash',
    'components/GraphicDisplay',
    'components/TextDisplay',
    'game-logic/GameEngineStore',
    'stores/GameSettingsStore'
], function(
    React,
    ReactDOM,
    _,
    GraphicDisplayClass,
    TextDisplayClass,
    GameEngineStore,
    GameSettingsStore
){

    var D = React.DOM;

    var GraphicDisplay = React.createFactory(GraphicDisplayClass);
    var TextDisplay = React.createFactory(TextDisplayClass);

    function getState(){
        return _.merge(
            _.pick(GameSettingsStore.getState(), ['graphMode', 'currentTheme']),
            _.pick(GameEngineStore, ['nyan', 'connectionState', 'maxWin'])
        );
    }

    return React.createClass({
        displayName: 'GraphicsContainer',

        propTypes: {
            isMobileOrSmall: React.PropTypes.bool.isRequired,
            controlsSize: React.PropTypes.string.isRequired
        },

        getInitialState: function () {
            var state = getState();
            state.width  = 0;
            state.height = 0;
            return state;
        },

        resizeAnimReq: null,
        onWindowResize: function() {
            var self = this;
            self.resizeAnimRequest = window.requestAnimationFrame(function(){
                var domNode = ReactDOM.findDOMNode(self);
                self.setState(_.merge(getState(), {
                    width: domNode.clientWidth,
                    height: domNode.clientHeight
                }));
            });
        },

        componentDidMount: function() {
            GameEngineStore.on({
                joined: this._onChange,
                disconnected: this._onChange,
                game_started: this._onChange,
                game_crash: this._onChange,
                game_starting: this._onChange,
                lag_change: this._onChange,
                nyan_cat_animation: this._onNyanAnim
            });
            GameSettingsStore.addChangeListener(this._onChange);
            window.addEventListener('resize', this.onWindowResize);

            // Call the resize handler once to setup the initial geometry of the
            // canvas displays.
            this.onWindowResize();
        },

        componentWillUnmount: function() {
            GameEngineStore.off({
                joined: this._onChange,
                disconnected: this._onChange,
                game_started: this._onChange,
                game_crash: this._onChange,
                game_starting: this._onChange,
                lag_change: this._onChange,
                nyan_cat_animation: this._onNyanAnim
            });
            GameSettingsStore.removeChangeListener(this._onChange);
            window.removeEventListener('resize', this.onWindowResize);
            window.cancelAnimationFrame(this.resizeAnimReq);
        },

        _onChange: function() {
            if(this.isMounted())
                this.setState(getState());
        },

        componentDidUpdate: function(prevProps, prevState) {
            // Detect changes on the controls size to trigger a window resize to
            // resize the canvas of the graphics display.
            if(this.props.controlsSize !== prevProps.controlsSize)
                this.onWindowResize();
        },

        _onNyanAnim: function() {
            this.setState({ nyan: true });
        },

        render: function() {
            var display = (this.state.graphMode === 'text')?
                  TextDisplay() :
                  GraphicDisplay(_.pick(this.state, ['currentTheme', 'width', 'height']));

            //Connection message
            var connectionMessage;
            switch(this.state.connectionState) {
                case 'CONNECTING':
                    connectionMessage = 'Connecting...';
                    break;
                case 'DISCONNECTED':
                    connectionMessage = 'Connection Lost ...';
                    break;
                default:
                    connectionMessage = null;
            }

            return D.div({ id: 'chart-inner-container', className: this.props.controlsSize, ref: 'container' },
                D.div({ className: 'anim-cont' },
                    D.div({ className: 'nyan' + (this.state.nyan? ' show' : '') },
                        this.state.nyan? D.img({ src: 'img/nyan.gif' }) : null
                    )
                ),
                D.div({ className: 'max-profit' },
                    'Max profit: ', (this.state.maxWin/1e8).toFixed(4), ' BTC'
                ),
                display,
                D.div({ className: 'connection-state' },
                    connectionMessage
                )
            );
        }
    });
});
