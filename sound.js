jQuery.fn.range = (function () {
  var _down = false,
      _val = 0,
      _options = {},
      _x = 0,
      _y = 0,
      _el,
      _pix = 1;


  function _mousedown(event) {
    _el = $(this);

    _down = true;
    _val = parseInt(_el.val(), 10);
    _options = _el.data('range-info');

    _x = event.clientX;
    _y = event.clientY;

    _pix = (_options.max - _options.min) / 500;

    $(document.body).bind('mousemove.range', _move).bind('mouseup.range', _mouseup);
  }

  function _move(event) {
    var val = parseInt(_val + (_y - event.clientY) * _pix, 10);

    if (val > _options.max || val < _options.min) {
      return;
    }

    _el.val(val).change();
  }

  function _mouseup() {
    $(document.body).unbind('.range');
  }

  return function (min, max, step) {
    var options = {};

    options.min = min || 0;
    options.max = max || 100;
    options.step = step || 1;

    this.data('range-info', options);

    this.mousedown(_mousedown);
  };
}());


var Sound = (function ($) {
    var me = {},

        SAMPLE_RATE = 44100, //htz
        SUSTAIN = 200, //ms
        ATTACK = 1,
        MAX_BUFFERS = 40,
        PI = Math.PI,
        TRACKS = 6,
        TEMPO = 60, //bpm
        NOTES = 8, //notes per beat

        DSP = ((new Audio()).mozWriteAudio) ? true : false,

        AudioCtx,
        _scale;

        if (webkitAudioContext) {
          AudioCtx = new webkitAudioContext;
        }

        if (DSP || AudioCtx) {
            _scale = [
                //164.81,
                196.00,
                261.63,
                329.628,
                391.995,
                523.251,
                1046.302
            ];
        }
        else {
            _scale = [
                'C2',
                'E2',
                'G2',
                'C3',
                'E3',
                'G3',
                'C4'
            ];
        }

    //Buffers, generates and caches simple sin() buffers for use in signal processing
    me.Buffers = (function () {
        var me = {},
            _buffers = {};

        function _genBuffer(freq) {
            var attack = parseInt(SAMPLE_RATE * ATTACK / 1000, 10),
                sus = parseInt(SAMPLE_RATE * SUSTAIN / 1000, 10),
                buffer = new Float32Array(attack + sus),

            factor = PI * freq * 2 / SAMPLE_RATE;

            for (var i = 0; i < attack; i++) {
              buffer[i] = Math.sin(i * factor) * i / attack;
            }

            for (l = buffer.length; i < l; i++) {
                //buffer[i] = Math.pow(-1, parseInt(i*factor));
                //buffer[i] = Math.sin(i * factor) * Math.exp(-i / 1600);
                buffer[i] = Math.sin(i * factor) * (l - i) / (l - attack);
            }

            return buffer;
        }

        function _genWebAudioBuffer(freq) {
            var attack = parseInt(SAMPLE_RATE * ATTACK / 1000, 10),
                sus = parseInt(SAMPLE_RATE * SUSTAIN / 1000, 10),
                audioBuffer = AudioCtx.createBuffer(1, attack + sus, SAMPLE_RATE),
                buffer = audioBuffer.getChannelData(0);

            factor = PI * freq * 2 / SAMPLE_RATE;

            for (var i = 0; i < attack; i++) {
              buffer[i] = Math.sin(i * factor) * i / attack;
            }

            for (l = buffer.length; i < l; i++) {
                //buffer[i] = Math.pow(-1, parseInt(i*factor));
                //buffer[i] = Math.sin(i * factor) * Math.exp(-i / 1600);
                buffer[i] = Math.sin(i * factor) * (l - i) / (l - attack);
            }

            return audioBuffer;
        }

        if (AudioCtx) {
          _genBuffer = _genWebAudioBuffer;
        }

        me.get = function (freq) {
          var key = freq + ':' + SAMPLE_RATE + ':' + SUSTAIN + ':' + ATTACK;

          if (!_buffers[key]) {
              _buffers[key] = _genBuffer(freq);
          }

          return _buffers[key];
        };

        return me;
    }());

    //Samples, grabs, caches, and plays sample wav files of a given frequency
    me.Samples = (function () {
        var me = {},
            _samples = {};

        function _getSample(note) {
            return new Audio('cello/' + note + '.wav');

            if (!_samples[note]) {
                _samples[note] = new Audio('cello/' + note + '.wav');
            }

            return _samples[note];
        }

        me.play = function (note) {
            _getSample(note).play();
        };

        return me;
    }());

    //Output, sends a buffer to a given (and generated) audio track using the Audio object
    me.Output = (function () {
        var me = {},

            _tracks = {};

        function _getTrack(track) {
            if (!_tracks[track]) {
                _tracks[track] = new Audio();
                _tracks[track].mozSetup(1, SAMPLE_RATE);
            }

            return _tracks[track];
        }

        function _getWebAudioTrack(track) {
          var source = AudioCtx.createBufferSource();
          source.connect(AudioCtx.destination);
          return source;
        }

        if (AudioCtx) {
          _getTrack = _getWebAudioTrack;
        }

        me.route = function (track, buffer) {
            var track = _getTrack(track);
            if (DSP) {
              track.mozWriteAudio(buffer);
            } else if (AudioCtx) {
              track.buffer = buffer;
              track.start(0);
            }
        };

        return me;
    }());

    //Tracks, generates and controls both the GUI and the underlying track matrix
    me.Tracks = (function (Sound) {
        var me = {},

            _tracks = [],
            _nodes = [],
            _interval,
            _prev = 0,
            _location = 0;

        //gen tracks
        for (var i = 0, j = 0; i < TRACKS; i++) {
            _tracks[i] = [];
            _nodes[i] = [];

            for (j = 0; j < NOTES; j++) {
                _tracks[i][j] = 0;
            }
        }

        //gen gui
        var sequencer = $('<div />').addClass('sequencer clearfix'),
            track, node;

        for (i = 0; i < TRACKS; i++) {
            track = $('<div />').addClass('track').appendTo(sequencer);

            for (j = 0; j < NOTES; j++) {
                node = $('<div />').addClass('node').appendTo(track);

                node.click(function (i, j) {
                    return function () {
                        $(this).toggleClass('on');
                        me.toggle(i, j);
                    }
                }(i, j));

                _nodes[i][j] = node;
            }
        }
        sequencer.appendTo('.sequencer-case');

        function _tick() {
            var prev = _location;

            _location++;
            if (_location >= NOTES) {
                _location = 0;
            }

            for (var i = 0; i < TRACKS; i++) {
                if (_tracks[i][prev]) {
                    if (DSP || AudioCtx) {
                        Sound.Output.route(i, Sound.Buffers.get(_scale[i]));
                    }
                    else {
                        Sound.Samples.play(_scale[i]);
                    }
                }
            }

            _paintColumn(prev, 1);
            setTimeout(function () {
                _paintColumn(prev, 0);
            }, 100);
        }

        function _paintColumn(col, on) {
            if (on) {
                for (var i = 0; i < TRACKS; i++) {
                    _nodes[i][col].addClass('ticked');
                }
            }
            else {
                for (var i = 0; i < TRACKS; i++) {
                    _nodes[i][col].removeClass('ticked');
                }
            }
        }

        me.toggle = function (track, location) {
            if (_tracks[track][location]) {
                _tracks[track][location] = 0;
            }
            else {
                _tracks[track][location] = 1;
            }

            return _tracks[track][location];
        };

        me.start = function () {
            if (_interval) {
                return;
            }

            var interval = 60000 / (TEMPO * NOTES);

            _interval = setInterval(_tick, interval);
        };

        me.stop = function () {
            clearInterval(_interval);
            _interval = 0;
        };

        me.playPause = function () {
          if (_interval) {
            me.stop();
          }
          else {
            me.start();
          }
        };

        return me;
    }(me));

    me.Controls = (function (Sound) {

      $(document.body).keydown(function (e) {
        if (e.which === 32) {
          e.preventDefault();
          me.playPause();
        }
      });

      $('.sample-rate').val(44100).change(function () {
        SAMPLE_RATE = parseInt($(this).val(), 10);
      }).range(0, 44100, 1);

      $('.sustain').val(200).change(function () {
        SUSTAIN = parseInt($(this).val(), 10);
      }).range(0, 2000, 1);

      $('.attack').val(1).change(function () {
        ATTACK = parseInt($(this).val(), 10);
      }).range(0, 200, 1);

    }(me));

    me.test = function () {
        me.Tracks.start();
    };

    me.playPause = me.Tracks.playPause;

    return me;
}(jQuery));

