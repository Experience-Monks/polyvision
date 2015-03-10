var ntp = require( 'socket-ntp-krcmod' );
var innkeeper = require( 'innkeeper-socket.io' );

module.exports = server;

function server( io ) {

  innkeeper( { io: io } );

  io.sockets.on( 'connection', function( socket ) {

    ntp.sync( socket );
  });
}