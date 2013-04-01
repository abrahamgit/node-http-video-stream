/*

	A video transcoding stream which converts an 
	input video from one format/quality/etc into
	another using FFMPEG.

	Is smart in a few ways:

		*	Does not transcode if there are no 
			output streams being piped to, and
			frees memory by destroying the
			FFMPEG object when not in use.

		*	Automatically pauses and resumes
			the transcoding process as streams
			being piped to are added/removed

*/

var stream 		= require('stream'),
	ffmpeg 		= require('/home/seannicholls/projects/github/node-fluent-ffmpeg'),
	util		= require('util');

function FfmpegTranscodeStream(options, config, preset) {

	if (!(this instanceof FfmpegTranscodeStream))
		return new FfmpegTranscodeStream(options);
	stream.Transform.call(this, options);

	var self			= this;
	this.super 			= stream.Transform;

	// inherit from transform stream class
	util.inherits(this, this.super);

	this.clientCount 	= 0;													// number of output streams being piped to
	this.transcoder 	= null;													// FFMPEG object
	this.preset 		= preset ? preset : null;								// FFMPEG preset object

	this.realtime		= true;													// enable/disable stream pausing when buffer is full.
																				// this does not prevent pausing when there are no
																				// output streams!

	this.config 		=  config ? config : { 	source: 	'',					// FFMPEG settings
												priority: 	10,
												nolog: 		false,
												timeout: 	-1 		};

	this.pipe = function(dst) {
  		
  		var state = this._readableState;
		if(state.pipesCount == 0) {
			// create FFMPEG object
			this.transcoder = new ffmpeg(this.config);
			this.transcoder = this.preset(this.transcoder);

			// start the process	
			this.transcoder.writeToStream(this, function(retcode, error){
				if(error) {
					console.log(error);
					// TODO: 	optional silence
					//			throw exception
				}
			});

			// emit event
			this.emit('transcode_start', this.transcoder);
		}

		this.super.call(this, 'pipe', dst);

	}

	this.unpipe = function(dst) {

  		var state = this._readableState;
		if(state.pipesCount == 0) {
			this.transcoder.stop(function(success) {
				self.transcoder = null;	
				self.emit('transcode_stop');
			});
		}

		this.super.call(this, 'unpipe', dst);

	}

	this._transform = function(chunk, encoding, done) {
		process.stdout.write('.');	// DEBUG
		this.push(chunk);
		done();
	}

}
util.inherits(FfmpegTranscodeStream, stream.Transform);

module.exports = FfmpegTranscodeStream;