var machina = require( "machina" );

var fileLoaderFactory = function( _, anvil ) {
	
	var loader = {
		name: "fileLoader",
		activity: "identify",
		commander: [
			[ "--ci", "continuously build on file changes" ]
		],
		prerequisites: [],
		excluded: [],
		config: {
			continuous: false,
			excluded: []
		},
		watchers: [],
		initialState: "waiting",

		buildDone: function() {
			this.handle( "build.done" );
		},

		buildFailed: function() {
			this.handle( "build.done" );
		},

		callback: function() {},

		configure: function( config, command, done ) {
			var exclude = config.fileLoader.excluded;
			exclude = exclude.concat( this.excluded );
			if( command.ci ) {
				anvil.config.fileLoader.continuous = true;
			}
			done();
		},

		loadSource: function( done ) {
			anvil.fs.getFiles( anvil.config.source, anvil.config.working, function( files, directories ) {
				anvil.project.files = files;
				anvil.project.directories = directories;
				anvil.log.event( "found " + directories.length + " directories with " + files.length + " files" );
				done();
			}, this.excluded );
		},

		loadSpecs: function( done ) {
			anvil.fs.getFiles( anvil.config.spec, anvil.config.working, function( files, directories ) {
				anvil.project.specs = files;
				anvil.project.directories = anvil.project.directories.concat( directories );
				anvil.log.event( "found " + files.length + " spec files" );
				done();
			} );
		},

		run: function( done ) {
			this.callback = done;
			this.transition( "scanning" );
		},

		watchAll: function() {
			this.watch( anvil.config.source );
			this.watch( anvil.config.spec );
		},

		watch: function( path ) {
			var self = this;
			this.watchers.push(
				anvil.fs.watch( path, function( event ) {
					self.handle( "file.change", event.name, path );
				} )
			);
		},

		unwatchAll: function() {
			while( this.watchers.length > 0 ) {
				this.watchers.pop().end();
			}
		},

		states: {
			"waiting": {
				_onEnter: function() {
					
				},
				"build.done": function() {
					self.transition( "watching" );
				}
			},

			"scanning": {
				_onEnter: function() {
					var self = this;
					this.excluded.push( anvil.config.output );
					this.loadSource( function() {
						self.loadSpecs( function() {
							self.transition( "watching" );
						} );
					} );
				}
			},

			"watching": {
				_onEnter: function() {
					if( this.config.continuous ) {
						this.watchAll();
					}
					this.callback();
				},
				"file.change": function( file, path ) {
					anvil.log.event( "file change in '" + file + "'" );
					anvil.events.raise( "file.changed", "change", file, path );
				}
			}
		}
	};
	
	return anvil.plugin( new machina.Fsm( loader ) );
};

module.exports = fileLoaderFactory;