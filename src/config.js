var configFactory = function( _, commander, path, anvil ) {

	var defaultConfig = {
		activityOrder: [
			"identify",
			"pull",
			"combine",
			"pre-process",
			"compile",
			"post-process",
			"push",
			"test"
		],
		working: "./.anvil/tmp",
		source: "./src",
		spec: "./spec",
		output: "./lib",
		tasks: "./tasks",
		log: {
			debug: false,
			"event": true,
			step: true,
			complete: true,
			warning: false,
			error: true
		}
	};

	anvil.config = defaultConfig;

	var Config = function() {
		_.bindAll( this );
		anvil.events.on( "commander.configured", this.processArguments );
		this.commands = {};
		this.args = [];
	};

	Config.prototype.checkDirectories = function( config ) {
		_.map( [ "working", "source", "spec" ], function( property ) {
			config[ property ] = path.resolve( config[ property ] );
		} );

		if( config.working === config.source ) {
			anvil.log.error( "Source, working and source directories MUST be seperate directories." );
			anvil.events.raise( "all.stop", -1 );
		}
	};

	Config.prototype.createCommand = function() {
		commander.version("{{{version}}}", "-v, --version" );
		if( this.args[ 2 ] && this.args[ 2 ].match( /^([-]v$|[-]{2}version)$/ ) ) {
			commander.parse( this.args );
		} else {
			anvil.onCommander( anvil.loadedConfig, commander );
		}
	};

	Config.prototype.getConfiguration = function( buildFile, onConfig ) {
		var self = this,
			calls = {
				user: function( done ) {
					self.loadPreferences(
						function( config ) {
							done( config );
						}
					);
				},
				local: function( done ) {
					self.loadConfig(
						buildFile,
						function( config ) {
							done( config );
						}
					);
				}
			};
		anvil.scheduler.mapped( calls, function( result ) {
			var config = _.deepExtend( result.user, result.local );
			onConfig( config );
		} );
	};

	Config.prototype.initialize = function( argList ) {
		this.args = argList;
		var self = this,
			log = anvil.config.log,
			argLine = argList.join(" "),
			match = argLine.match( /(([-]b)|([-]{2}build))[ ](\w+)/ ),
			buildFile = match ? "./" + match[4] + ".json" : "./build.json";
		
		if( _.any( argList, function( arg ) { return arg === "-q" || arg === "--quiet"; } ) ) {
			log.debug = false;
			log["event"] = false;
			log.warning = false;
		} else if ( _.any( argList, function( arg ) { return arg == "--verbose"; } ) ) {
			log.debug = true;
			log.warning = true;
		}

		this.getConfiguration( buildFile, function( config ) {
			anvil.loadedConfig = config;
			self.createCommand();
		} );
	};

	Config.prototype.loadConfig = function( file, onComplete ) {
		file = path.resolve( file );
		if( anvil.fs.pathExists( file ) ) {
			anvil.fs.read( file, function( content ) {
				onComplete( JSON.parse( content ) );
			} );
		} else {
			onComplete( {} );
		}
	};

	Config.prototype.loadPreferences = function( onComplete ) {
		var userDefaults = {};
		if( anvil.fs.pathExists( "~/.anvil" ) ) {
			anvil.fs.read( "~/.anvil", function( content ) {
				userDefaults = JSON.parse( content );
				onComplete( userDefaults );
			} );
		} else {
			onComplete( userDefaults );
		}
	};

	Config.prototype.processArguments = function() {
		try {
			commander.parse( this.args );
		} catch ( err ) {
			anvil.log.error( "Error processing arguments (" + this.args + ") :" + err + "\n" + err.stack );
		}
		var config = _.deepExtend( defaultConfig, anvil.config, anvil.loadedConfig );
		this.checkDirectories( config );
		anvil.onConfig( config );
	};

	return new Config();
};

module.exports = configFactory;