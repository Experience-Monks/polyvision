var app = require( 'http' ).createServer( function() {} );
var io = require( 'socket.io' )( app );
var polyvision = require( './..' );

app.listen( 3333 );

polyvision( io );