define([
    'react',
    'react-dom',
    'components/Game',
    'mousetrap'
], function(
    React,
    ReactDOM,
    GameClass,
    Mousetrap
) {

    var Game = React.createFactory(GameClass);

    Mousetrap.bind('backspace', function(e) {
        if(!confirm('Are you sure you want to leave the site?')) {
            if (e.preventDefault) {
                e.preventDefault();
            } else {
                // internet explorer
                e.returnValue = false;
            }
        }
    });

    ReactDOM.render(
        Game(),
        document.getElementById('game-container')
    );
});