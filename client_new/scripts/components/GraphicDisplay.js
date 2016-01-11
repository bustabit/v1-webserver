/**
 * The code that renders the canvas.
 */

define([
    'react',
    'react-dom',
    'game-logic/clib',
    'game-logic/stateLib',
    'lodash',
    'game-logic/GameEngineStore'
], function(
    React,
    ReactDOM,
    Clib,
    StateLib,
    _,
    Engine
){
    var D = React.DOM;

    // Styling
    function style(theme, ratio, width) {
      function combineTheme(obj) {
        if (typeof obj[theme] === 'string')
          return obj[theme];
        else
          return _.assign({}, obj.base, obj[theme]);
      }

      function combineState(obj) {
        // Possible states and their inheritance graph. All derive also from base.
        var states = {
          playing: [],
          cashed: [],
          lost: [],
          starting: [],
          startingBetting: ['starting', 'playing'],
          progress: [],
          progressPlaying: ['progress', 'playing'],
          progressCashed: ['progress', 'cashed'],
          ended: [],
          endedCashed: ['ended', 'cashed']
        };

        return _.mapValues(states, function(sups, state) {
          var res = _.assign({}, obj.base || {});
          _.forEach(sups, function(sup) {
            _.assign(res, obj[sup] || {});
          });
          _.assign(res, obj[state]);
          return res;
        });
      }

      // Multiply one percent of canvas width x times
      function fontSizeNum(times) {
        return times * width / 100;
      }

      // Return the font size in pixels of one percent
      // of the width canvas by x times.
      function fontSizePx(times) {
        var fontSize = fontSizeNum(times);
        return fontSize.toFixed(2) + 'px';
      }

      var strokeStyle = combineTheme({
        white: 'Black',
        black: '#b0b3c1'
      });

      var fillStyle = combineTheme({
        white: 'black',
        black: '#b0b3c1'
      });

      return {
        fontSizeNum: fontSizeNum,
        fontSizePx: fontSizePx,
        graph: combineState({
          base: {
            lineWidth: 4*ratio,
            strokeStyle: strokeStyle
          },
          playing: {
            lineWidth: 6*ratio,
            strokeStyle: '#7cba00'
          },
          cashed: {
            lineWidth: 6*ratio /*, strokeStyle = "Grey" */
          }
        }),
        axis: {
          lineWidth: 1 * ratio,
          font: (10*ratio).toFixed(2) + "px Verdana",
          textAlign: "center",
          strokeStyle: strokeStyle,
          fillStyle: fillStyle
        },
        data: combineState({
          base: {
            textAlign: 'center',
            textBaseline: 'middle'
          },
          starting: {
            font: fontSizePx(5) + " Verdana",
            fillStyle: "grey"
          },
          progress: {
            font: fontSizePx(20) + " Verdana",
            fillStyle: fillStyle
          },
          progressPlaying: {
            fillStyle: '#7cba00'
          },
          ended: {
            font: fontSizePx(15) + " Verdana",
            fillStyle: "red"
          }
        })
      };

      // if(self.lag) {
      //     context.fillStyle = "black";
      //     context.font="20px Verdana";
      //     context.fillText('Network Lag', 250, 250);
      // }
    }

    function Graph() {
        this.rendering = false;
        this.animRequest = null;
    }

    Graph.prototype.startRendering = function(canvasNode, config) {
        this.rendering = true;

        if (!canvasNode.getContext)
            return console.error('No canvas');

        this.ctx = canvasNode.getContext('2d');
        this.canvas = canvasNode;
        this.configPlotSettings(config);

        this.animRequest = window.requestAnimationFrame(this.render.bind(this));
    };

    Graph.prototype.stopRendering = function() {
        this.rendering = false;
    };

    Graph.prototype.render = function() {
        if(!this.rendering)
            return;

        this.calcGameData();
        this.calculatePlotValues();
        this.clean();
        this.drawGraph();
        this.drawAxes();
        this.drawGameData();
        this.animRequest = window.requestAnimationFrame(this.render.bind(this));
    };

    Graph.prototype.configPlotSettings = function(config) {
        // From: http://www.html5rocks.com/en/tutorials/canvas/hidpi/
        var devicePixelRatio = window.devicePixelRatio || 1;
        var backingStoreRatio =
            this.ctx.webkitBackingStorePixelRatio ||
            this.ctx.mozBackingStorePixelRatio ||
            this.ctx.msBackingStorePixelRatio ||
            this.ctx.oBackingStorePixelRatio ||
            this.ctx.backingStorePixelRatio || 1;

        // Only update these settings if they really changed to avoid rendering hiccups.
        if (this.configWidth !== config.width ||
            this.configHeight !== config.height ||
            this.devicePixelRatio !== devicePixelRatio ||
            this.backingStoreRatio !== backingStoreRatio) {
            if (devicePixelRatio === backingStoreRatio) {
                this.canvasWidth = this.canvas.width = config.width;
                this.canvasHeight = this.canvas.height = config.height;
            } else {
                this.canvasWidth = this.canvas.width = config.width*this.ratio;
                this.canvasHeight = this.canvas.height = config.height*this.ratio;
            }
            this.canvas.style.width = config.width + 'px';
            this.canvas.style.height = config.height + 'px';
        }

        this.configWidth = config.width;
        this.configHeight = config.height;
        this.devicePixelRatio = devicePixelRatio;
        this.backingStoreRatio = backingStoreRatio;
        this.ratio = devicePixelRatio / backingStoreRatio;

        this.theme = config.currentTheme;
        this.style = style(this.theme, this.ratio, this.canvasWidth);

        this.plotWidth = this.canvasWidth - 30*this.ratio;
        this.plotHeight = this.canvasHeight - 20*this.ratio; //280
        this.xStart = this.canvasWidth - this.plotWidth;
        this.yStart = this.canvasHeight - this.plotHeight;
        this.XAxisPlotMinValue = 10000;    //10 Seconds
        this.YAxisSizeMultiplier = 2;    //YAxis is x times
        this.YAxisInitialPlotValue = "zero"; //"zero", "betSize" //TODO: ???
    };

    Graph.prototype.calcGameData = function() { //TODO: Use getGamePayout from engine.
        this.currentTime = Clib.getElapsedTimeWithLag(Engine);
        this.currentGamePayout = Clib.calcGamePayout(this.currentTime);
    };

    Graph.prototype.calculatePlotValues = function() {

        //Plot variables
        this.XAxisPlotValue = Math.max(this.currentTime, this.XAxisPlotMinValue);
        this.YAxisPlotMinValue = this.YAxisSizeMultiplier;
        this.YAxisPlotValue = Math.max(this.currentGamePayout, this.YAxisPlotMinValue);

        //We start counting from cero to plot
        this.YAxisPlotValue-=1;

        //Graph values
        this.widthIncrement = this.plotWidth / this.XAxisPlotValue;
        this.heightIncrement = this.plotHeight / (this.YAxisPlotValue);
    };

    Graph.prototype.clean = function() {
        this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
    };

    Graph.prototype.drawGraph = function() {

        var style = this.style.graph;
        var ctx = this.ctx;

        // Style the line depending on the game state.
        _.assign(ctx,
          // Playing and not cashed out
          StateLib.currentlyPlaying(Engine)? style.playing :
          // Cashing out
          Engine.cashingOut? style.cashed :
          // Otherwise
          style.progress
        );

        ctx.beginPath();
        Clib.seed(1);

        /* Draw the graph */
        for(var t=0, i=0; t <= this.currentTime; t+= 100, i++) {

            /* Graph */
            var payout = Clib.calcGamePayout(t)-1; //We start counting from one x
            var y = this.plotHeight - (payout * this.heightIncrement);
            var x = t * this.widthIncrement;
            ctx.lineTo(x + this.xStart, y);

            /* Draw green line if last game won */ //TODO: Avoid doing the code above this if it will do this
            /*var realPayout = Clib.payout(this.betSize, t);
             if(this.lastGameWon && (Clib.payout(this.betSize, t) > this.lastWinnings) && !greenSetted) {
             var tempStroke = ctx.strokeStyle;
             ctx.strokeStyle = '#7cba00';
             ctx.stroke();

             ctx.beginPath();
             ctx.lineWidth = 3*this.ratio;
             ctx.moveTo(x + this.xStart, y);
             ctx.strokeStyle = tempStroke;
             greenSetted = true;
             }*/

            /* Avoid crashing the explorer if the cycle is infinite */
            if(i > 5000) {console.log("For 1 too long!");break;}
        }
        ctx.stroke();
    };

    Graph.prototype.drawAxes = function() {

        //Function to calculate the plotting values of the Axes
        function stepValues(x) {
            console.assert(_.isFinite(x));
            var c = .4;
            var r = .1;
            while (true) {

                if (x <  c) return r;

                c *= 5;
                r *= 2;

                if (x <  c) return r;
                c *= 2;
                r *= 5;
            }
        }

        //Calculate Y Axis
        this.YAxisPlotMaxValue = this.YAxisPlotMinValue;
        this.payoutSeparation = stepValues(!this.currentGamePayout ? 1 : this.currentGamePayout);

        var ctx = this.ctx;
        _.assign(ctx, this.style.axis);

        //Draw Y Axis Values
        for(var payout = this.payoutSeparation, i = 0; payout < this.YAxisPlotValue; payout+= this.payoutSeparation, i++) {
            var y = this.plotHeight - (payout*this.heightIncrement);
            ctx.fillText((payout+1)+'x', 10*this.ratio, y);

            ctx.beginPath();
            ctx.moveTo(this.xStart, y);
            ctx.lineTo(this.xStart + 5*this.ratio, y);
            ctx.stroke();

            if(i > 100) { console.log("For 3 too long"); break; }
        }

        //Calculate X Axis
        this.milisecondsSeparation = stepValues(this.XAxisPlotValue);
        this.XAxisValuesSeparation = this.plotWidth / (this.XAxisPlotValue/this.milisecondsSeparation);

        //Draw X Axis Values
        for(var miliseconds = 0, counter = 0, i = 0; miliseconds < this.XAxisPlotValue; miliseconds+=this.milisecondsSeparation, counter++, i++) {
            var seconds = miliseconds/1000;
            var textWidth = ctx.measureText(seconds).width;
            var x = (counter*this.XAxisValuesSeparation) + this.xStart;
            ctx.fillText(seconds, x - textWidth/2, this.plotHeight + 11*this.ratio);

            if(i > 100) { console.log("For 4 too long"); break; }
        }

        //Draw background Axis
        ctx.beginPath();
        ctx.moveTo(this.xStart, 0);
        ctx.lineTo(this.xStart, this.canvasHeight - this.yStart);
        ctx.lineTo(this.canvasWidth, this.canvasHeight - this.yStart);
        ctx.stroke();
    };

    Graph.prototype.drawGameData = function() {

      var style = this.style.data;
      var ctx = this.ctx;

      switch (Engine.gameState) {
      case 'STARTING':
        var timeLeft = ((Engine.startTime - Date.now())/1000).toFixed(1);
        _.assign(ctx, style.starting);
        ctx.fillText(
          'Next round in '+timeLeft+'s',
          this.canvasWidth/2,
          this.canvasHeight/2
        );
        break;

      case 'IN_PROGRESS':
        _.assign(ctx, StateLib.currentlyPlaying(Engine)?
                        style.progressPlaying : style.progress);
        ctx.fillText(
          parseFloat(this.currentGamePayout).toFixed(2) + 'x',
          this.canvasWidth/2,
          this.canvasHeight/2
        );
        break;

      case 'ENDED':
        _.assign(ctx, style.ended);
        ctx.fillText(
          'Busted', this.canvasWidth/2,
          this.canvasHeight/2 - this.style.fontSizeNum(15)/2
        );
        ctx.fillText(
          '@ ' + Clib.formatDecimals(Engine.tableHistory[0].game_crash/100, 2) + 'x',
          this.canvasWidth/2,
          this.canvasHeight/2 + this.style.fontSizeNum(15)/2
        );
        break;
      }

      //if(this.lag) {
      //    ctx.fillStyle = "black";
      //    ctx.font="20px Verdana";
      //    ctx.fillText('Network Lag', 250, 250);
      //}
    };

    return React.createClass({
        displayName: 'GraphicsDisplay',
        mixins: [React.addons.PureRenderMixin],
        propTypes: {
            width: React.PropTypes.number.isRequired,
            height: React.PropTypes.number.isRequired,
            currentTheme: React.PropTypes.string.isRequired
        },

        graph: new Graph(),

        componentDidMount: function() {
            this.graph.startRendering(ReactDOM.findDOMNode(this), this.props);
        },

        componentWillUnmount: function() {
            this.graph.stopRendering();
        },

        componentDidUpdate: function() {
            this.graph.configPlotSettings(this.props);
        },

        render: function() {
            return D.canvas();
        }
    });
});
