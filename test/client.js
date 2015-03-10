var io = require( 'socket.io-client' );
var polyvision = require( './../client' );

var socket = io( 'http://localhost:3333' );



polyvision( socket )
.then( function( client ) {

  console.log( 'initialized', client );

  client.on( 'user', function( info ) {

    console.log( 'users', info.users );
  });

  client.on( 'play', function() {

    console.log( 'playing' );
  });

  window.enter = function() {

    client.enter()
    .then( function( client ) {

      console.log( 'in a room', client.room.id ); 
    })
    .catch( function() {

      console.log( 'error', arguments );
    });
  };

  window.join = function( id ) {

    client.enter( id )
    .then( function( client ) {

      console.log( 'in a room', client.room.id ); 
    })
    .catch( function() {

      console.log( 'error', arguments );
    });

    window.play = function() {

      client.play();
    };
  };
});