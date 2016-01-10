define([
    'react',
    'react-dom',
    'lodash'
], function(
    React,
    ReactDOM,
    _
){

    var D = React.DOM;

    /** Abstraction for using radio buttons as components in react **/
    return React.createClass({
        displayName: 'reactRadio',

        propTypes: {
            name: React.PropTypes.string.isRequired,
            value: React.PropTypes.string, //Selected radio, not way to change it,
            defaultValue: React.PropTypes.string, //Default value, selected
            onChange: React.PropTypes.func.isRequired
        },

        //When mounting the component we set the default value
        componentDidMount: function() {
            this.update();
        },

        //If the component updates we don't want the component to return to the default value
        componentDidUpdate: function() {
            //this.update();
        },

        update: function() {
            if(this.props.defaultValue && !this.props.value)
                this.setSelectedRadio(this.props.defaultValue);
        },

        change: function() {
            if(!this.props.value)
                this.props.onChange(this.getSelectedRadio());
        },

        getSelectedRadio: function() {
            var radios = this.getRadios();

            for(var i=0, length = radios.length; i < length; i++)
                if(radios[i].checked)
                    return radios[i].value;

            return null;
        },

        setSelectedRadio: function(value) {
            var radios = this.getRadios();

            for(var i = 0, length = radios.length; i < length; i++)
                if(radios[i].value == value)
                    radios[i].checked = true;
        },

        getRadios: function() {
            return ReactDOM.findDOMNode(this).querySelectorAll('input[type="radio"]');
        },

        render: function() {
            var self = this;

            return D.div({ onChange: this.change },
                React.Children.map(this.props.children, function(child) {

                    if (child.type !== 'input' || child.props.type !== 'radio')
                      return child; // Render child unchanged

                    // Child is an input[type="radio"] DOM element and React throws
                    // a warning if you give it children. Make that an error here.
                    console.assert(!child.props.children);

                    var newProps = { name: self.props.name };

                    // If the user sends a value disable all the other options
                    if(self.props.value)
                        if(child.props.value !== self.props.value)
                            newProps.disabled = true;
                        else {
                            newProps.checked = true;
                            newProps.readOnly = true;
                        }

                    // Create a clone with updated props.
                    return React.cloneElement(child, newProps);
                })
            );
        }
    });

});