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

    return this.mousedown(_mousedown);
  };
}());

jQuery.fn.rangeVal = function () {
  var rangeInfo = this.data('range-info');
  return this.val() * (rangeInfo.max - rangeInfo.min) / 100 + rangeInfo.min;
};

(function ($) {
  var oldOn = $.fn.on;

  var _eventMap = {
    'click': 'touchstart',
    'mousedown': 'touchstart',
    'mousemove': 'touchmove',
    'mouseup': 'touchend'
  };

  $.fn.touchon = function (events, handler) {
    var events = events.split(' ');
    var touchEvents = [];
    var normalEvents = [];

    $.each(events, function (i, event) {
      if (_eventMap[event]) {
        touchEvents.push(_eventMap[event]);
      } else {
        normalEvents.push(event);
      }
    });

    this.each(function () {
      var self = this;
      $.each(touchEvents, function (i, event) {
        self.addEventListener(event, handler);
      });
    });

    return oldOn.call(this, normalEvents.join(' '), handler);
  };
}(jQuery));


var Sound = (function ($) {
    var me = {},
        Sound = me,

        Params = {
          t: 60,
          a: 1,
          s: 200,
          deA: 0,
          deT: 1,
          deF: 0,
          diA: 0,
          diD: 100,
          diC: 0,
          p: 0,
          st: 'b',
          sc: 'p'
        },

        // I remember Touch
        TOUCH = 'ontouchstart' in document.documentElement,

        MAX_SAMPLE_RATE = 44100,
        MIN_SAMPLE_RATE = 22050,
        SAMPLE_RANGE = MAX_SAMPLE_RATE - MIN_SAMPLE_RATE,
        SAMPLE_RATE = 44100, //htz
        SUSTAIN = 200, //ms
        ATTACK = 1,
        MAX_BUFFERS = 40,
        PI = Math.PI,
        TRACKS = 11,
        TEMPO = 60, //bpm
        NOTES = 32, //notes per beat

        DSP = ((new Audio()).mozWriteAudio) ? true : false,

        AudioCtx,
        _scale,
        _majorScale,
        _pScale;

      if (TOUCH) {
        $.fn.on = $.fn.touchon;
      }

        if (location.search) {
          var el;
          var list = location.search.slice(1).split('&');

          for (var i = 0; i < list.length; i++) {
            el = list[i].split('=');
            Params[el[0]] = el[1];
          }

          if (Params.t) {
            TEMPO = parseInt(Params.t, 10);
          }

          SUSTAIN = Params.s || SUSTAIN;
          ATTACK = Params.a || SUSTAIN;
        }

        Sound.Params = Params;

        if (webkitAudioContext) {
          AudioCtx = Sound.ctx = new webkitAudioContext;
        }

        if (DSP || AudioCtx) {
            _majorScale = [
                65.4064,
                82.4069,
                97.9989,
                130.813,
                164.814,
                195.998,
                261.626,
                329.628,
                391.995,
                523.251,
                659.255,
                783.991,
                1046.50
            ];

            _pScale = [
              65.4064,
              73.4162,
              82.4069,
              97.9989,
              110.000,
              130.813,
              146.832,
              164.814,
              195.998,
              220.000,
              261.626,
              293.665,
              329.628,
              391.995,
              440.000,
              523.251,
              587.330,
              659.255,
              783.991,
              880.000,
              987.767,
              1046.50,
              1174.66,
              1318.51
            ];

            _scale = _pScale;
            TRACKS = _scale.length;
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

    me.paramsString = function () {
      var st = [];

      for (var i in Params) {
        st.push(i + '=' + Params[i]);
      }

      return st.join('&');
    };

    me.deferPush = function () {
      setTimeout(me.push, 0);
    };

    me.push = function () {
      Params.g = me.Tracks.tracksMask();
      Params.t = TEMPO;
      Params.a = ATTACK;
      Params.s = SUSTAIN;

      Params.deT = Sound.Output.delay.delay.delayTime.value.toFixed(3);
      Params.deA = Sound.Output.delay.wetDry.wet.gain.value.toFixed(3);
      Params.deF = Sound.Output.delay.feedback.wet.gain.value.toFixed(3);

      Params.diA = Sound.Output.distortion.wetDry.wet.gain.value.toFixed(3);
      Params.diD = Sound.Output.distortion.__amount.toFixed(3);
      Params.diC = Sound.Output.distortion.__curve.toFixed(3);

      history.pushState({}, '', '?' + me.paramsString());
    };

    me.Nodes = (function () {
      var me = {};

      function createGain() {
        if (AudioCtx.createGain) {
          return AudioCtx.createGain();
        } else {
          return AudioCtx.createGainNode();
        }
      }

      me.createWetDry = function () {
        var node = {};

        node.wet = createGain();
        node.dry = createGain();

        node.setWet = function (percentage) {
          this.wet.gain.value = percentage;
          this.dry.gain.value = 1 - percentage;
        };

        node.setWetDry = function (wet, dry) {
          this.wet.gain.value = wet;
          this.dry.gain.value = dry;
        };

        node.input = function (node) {
          node.connect(this.wet);
          node.connect(this.dry);
        };

        return node;
      };

      me.createDelay = function () {
        var node = {};

        if (AudioCtx.createDelay) {
          node.delay = AudioCtx.createDelay(2);
        } else {
          node.delay = AudioCtx.createDelayNode(2);
        }
        node.delay.delayTime.value = Params.deT;

        node.wetDry = me.createWetDry();
        node.wetDry.setWet(Params.deA);

        node.feedback = me.createWetDry();
        node.feedback.setWetDry(Params.deF, 1);

        node.wetDry.wet.connect(node.delay);
        node.feedback.input(node.delay);
        node.feedback.wet.connect(node.delay);

        node.connect = function (otherNode) {
          this.feedback.dry.connect(otherNode);
          this.wetDry.dry.connect(otherNode);
        };

        node.input = function (node) {
          this.wetDry.input(node);
        };

        return node;
      };

      me.createDistortion = function () {
        var node = {};

        node.waveShaper = AudioCtx.createWaveShaper();
        node.wetDry = me.createWetDry();
        node.wetDry.setWet(Params.diA - 0);

        node.wetDry.wet.connect(node.waveShaper);

        node.__amount = Params.diD - 0;
        node.__curve = Params.diC - 0;
        node.__snap = 0;

        node.waveShaper.curve = new Float32Array([
          0.0, 0.5, 0.7, 0.9, 0.95, 0.985, 0.995, 1
        ]);

        node.connect = function (node) {
          this.wetDry.dry.connect(node);
          this.waveShaper.connect(node);
        };

        node.input = function (node) {
          this.wetDry.input(node);
        };

        node.amount = function (amount) {
          var step = 1 / amount;
          var piStep = Math.PI / 2;
          var arr = [];

          this.__amount = amount;

          for (var i = 0; i <= amount; i++) {
            arr[i] = (i * step + Math.sin(i * piStep) * this.__curve + 1 * this.__snap) / (1 + this.__curve + this.__snap);
            //arr[i] = (1 - this.__curve) * i * step + this.__curve * Math.cos(i * Math.PI / amount + Math.PI);
            //arr[i] = i * step + (Math.random() * step * 2 - step) * this.__curve;
          }

          this.waveShaper.curve = new Float32Array(arr);
        };

        node.curve = function (amount) {
          this.__curve = amount;
          node.amount(this.__amount);
        };

        node.snap = function (amount) {
          this.__snap = amount;
          node.amount(this.__amount);
        };

        node.amount(Params.diD - 0);

        return node;
      };

      return me;
    }());

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

            _tracks = {},
            _compressor;

        function _getTrack(track) {
            if (!_tracks[track]) {
                _tracks[track] = new Audio();
                _tracks[track].mozSetup(1, SAMPLE_RATE);
            }

            return _tracks[track];
        }

        function _getWebAudioTrack(track) {
          var source = AudioCtx.createBufferSource();
          //source.connect(_compressor);
          _delay.input(source);
          return source;
        }

        if (AudioCtx) {
          _getTrack = _getWebAudioTrack;
          _compressor = AudioCtx.createDynamicsCompressor();
          _compressor.connect(AudioCtx.destination);

          me.biquad = AudioCtx.createBiquadFilter();
          me.biquad.type = "lowpass";
          me.biquad.frequency.value = 440;
          me.biquad.Q.value = 0.1;
          me.biquad.connect(_compressor);

          me.distortion = Sound.Nodes.createDistortion();
          me.distortion.connect(me.biquad);

          _delay = Sound.Nodes.createDelay();
          me.distortion.input(_delay);

          me.delay = _delay;
        }

        me.route = function (track, buffer) {
            var track = _getTrack(track);
            if (DSP) {
              track.mozWriteAudio(buffer);
            } else if (AudioCtx) {
              track.buffer = buffer;
              if (track.start) {
                track.start(0);
              } else {
                track.noteOn(0);
              }
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

        me.init = function () {
          me.clearTracks();
          me.parseMask();
          me.gen();
        };

        me.clearTracks = function () {
          //gen tracks
          for (var i = 0, j = 0; i < TRACKS; i++) {
              _tracks[i] = [];
              _nodes[i] = [];

              for (j = 0; j < NOTES; j++) {
                  _tracks[i][j] = 0;
              }
          }
        };

        me.clear = function () {
          me.clearTracks();
          me.gen();
          Sound.push();
        };

        me.gen = function () {
          //gen gui
          var sequencer = $('<div />').addClass('sequencer clearfix'),
              track, node;

          for (i = 0; i < TRACKS; i++) {
              track = $('<div />').addClass('track').appendTo(sequencer);

              for (j = 0; j < NOTES; j++) {
                  node = $('<div />').addClass('node').appendTo(track);

                  if (_tracks[i][j]) {
                    node.addClass('on');
                  }

                  var _mousedown = (function (i, j) {
                    return function (e) {
                      $(this).toggleClass('on');
                      me.toggle(i, j);
                      e.preventDefault();
                    }
                  }(i, j));

                  node.on('mousedown', _mousedown)
                    .on('mouseenter', function (e) {
                      if (Sound.Controls.downmouse) {
                        _mousedown.call(this, e);
                      }
                    });

                  _nodes[i][j] = node;
              }
          }

          sequencer.replaceAll('.sequencer');
        };

        function _tick() {
          var ct = AudioCtx.currentTime;

          if (ct < me.ct + me.interval) {
            return
          }
          me.ct += me.interval;

            var prev = _location;

            _location++;
            if (_location >= NOTES) {
                _location = 0;
            }

            for (var i = 0; i < TRACKS; i++) {
                if (_tracks[i][_location]) {
                    if (DSP || AudioCtx) {
                        Sound.Output.route(i, Sound.Buffers.get(_scale[i]));
                    }
                    else {
                        Sound.Samples.play(_scale[i]);
                    }
                }
            }

            _paintColumn(_location, 1);
            _paintColumn(prev, 0);
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

            setTimeout(function () {
              Sound.push();
            }, 0);

            return _tracks[track][location];
        };

        me.flatTracks = function () {
          var hash = '';

          for (var i = 0; i < _tracks.length; i++) {
            hash += _tracks[i].join('');
          }

          return hash;
        };

        me.tracksMask = function () {
          var hash = '';
          var mask;

          for (var i = 0; i < TRACKS; i++) {
            mask = 0;

            for (var j = 0; j < NOTES; j++) {
              mask = mask << 1;
              mask += _tracks[i][j];
            }

            hash += mask + 'x';
          }

          return hash;
        };

        me.parseMask = function () {
          if (location.search) {
            var mask = location.search.slice(3);
            var masks;

            if (mask) {
              masks = mask.split('x');

              for (var i = 0; i < TRACKS; i++) {
                mask = masks[i];

                for (var j = 0; j < NOTES; j++) {
                  _tracks[i][NOTES - j - 1] = mask & 1;
                  mask = mask >> 1;
                }
              }
            }
          }

          return _tracks;
        };

        me.start = function () {
            if (_interval) {
                return;
            }

            me.interval = 60 / (TEMPO * NOTES);
            me.ct = AudioCtx.currentTime;

            // terribly hacky test
            if ('ipad' && AudioCtx.createGainNode) {
              var node = AudioCtx.createOscillator();
              node.connect(AudioCtx.destination);
              node.noteOn(0);
              node.noteOff(0);
            }

            _interval = setInterval(_tick, 10);
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

        me.init();

        return me;
    }(me));

    me.Controls = (function (Sound) {
      var Controls = {};

      Controls.downmouse = false;

      $('.playpause').on('click', function (e) {
        Sound.playPause();
      });

      $('.controls').on('mousedown', function (e) {
        e.stopPropagation();
      });

      $(document.body).keydown(function (e) {
        if (e.which === 32) {
          e.preventDefault();
          me.playPause();
        } else if (e.which === 27) {
          presentationMode();
        }
      }).on('mousedown', function () {
        Controls.downmouse = true;
      }).on('mouseup', function () {
        Controls.downmouse = false;
      });

      function presentationMode() {
        // need to figure this out
        if (TOUCH) {
          return;
        }

        var $body = $('body');
        var pres = $body.hasClass('presentation');

        $body.toggleClass('presentation');

        setTimeout(function () {
          if (pres) {
            Params.p = 0;
            $('.controls').show();
          } else {
            Params.p = 1;
            $('.controls').hide();
          }
          Sound.deferPush();
        }, 200);
      }

      if (Params.p === '1') {
        presentationMode();
      }

      $('.scale').on('change', function () {
        if ($(this).attr('selectedIndex') === 0) {
          _scale = _majorScale;
          $('body').removeClass('pentatonic');
          Params.sc = 'd';
        } else {
          _scale = _pScale;
          $('body').addClass('pentatonic');
          Params.sc = 'p';
        }

        TRACKS = _scale.length;
        Sound.Tracks.clear();
        Sound.deferPush();
      });

      $('.style').on('change', function () {
        $('#sequencer').attr('class', $(this).val());
        Params.st = ($(this).val() === 'buttons') ? 'b' : 's';
        Sound.deferPush();
      }).attr('selectedIndex', (Params.st === 'b') ? 0 : 1).change();

      $('.style-mode').on('click', function () {
        presentationMode();
      });

      $('.sample-rate').val(100).on('change', function () {
        SAMPLE_RATE = parseInt($(this).val() * SAMPLE_RANGE / 100 + MIN_SAMPLE_RATE, 10);
        // this now longer does crap
      }).range(22050, 44100, 1);

      $('.tempo').val(Math.floor(TEMPO / 120 * 100)).on('change', function() {
        TEMPO = parseInt(1.2 * $(this).val(), 10);
        me.Tracks.stop();
        me.Tracks.start();
        setTimeout(function () {
          Sound.push();
        }, 0);
      });

      $('.sustain').val(SUSTAIN / 10).on('change', function () {
        //SUSTAIN = parseInt($(this).val(), 10);
        SUSTAIN = 10 * $(this).val();
        Sound.deferPush();
      }).range(0, 2000, 1);

      $('.attack').val(ATTACK / 2).on('change', function () {
        //ATTACK = parseInt($(this).val(), 10);
        ATTACK = 2 * $(this).val();
        Sound.deferPush();
      }).range(0, 200, 1);

      $('.delay-time').val(Sound.Output.delay.delay.delayTime.value * 50).on('change', function () {
        Sound.Output.delay.delay.delayTime.value = $(this).rangeVal();
        Sound.deferPush();
      }).range(0, 2);

      $('.delay-wet').val(Sound.Output.delay.wetDry.wet.gain.value * 100).on('change', function () {
        Sound.Output.delay.wetDry.setWet($(this).rangeVal());
        Sound.deferPush();
      }).range(0, 1);

      $('.delay-feedback').val(Sound.Output.delay.feedback.wet.gain.value * 200).on('change', function () {
        Sound.Output.delay.feedback.wet.gain.value = $(this).rangeVal();
        Sound.deferPush();
      }).range(0, 1);

      $('.distortion-wet').val(Sound.Output.distortion.wetDry.wet.gain.value * 100).range(0, 1)
        .on('change', function () {
          console.log($(this).rangeVal());
          Sound.Output.distortion.wetDry.setWet($(this).rangeVal());
          Sound.deferPush();
        });

      $('.distortion-depth').val(Sound.Output.distortion.__amount).range(1, 100).on('change', function () {
        Sound.Output.distortion.amount($(this).rangeVal());
        Sound.deferPush();
      });

      $('.distortion-curve').val(Sound.Output.distortion.__curve * 100).range(0, 1).on('change', function () {
        Sound.Output.distortion.curve($(this).rangeVal());
        Sound.deferPush();
      });

      $('.distortion-snap').val(0).range(0, 1).on('change', function () {
        Sound.Output.distortion.snap($(this).rangeVal());
        Sound.deferPush();
      });

      $('.clear').on('click', function () {
        Sound.Tracks.clear();
      });

      return Controls;
    }(me));

    me.test = function () {
        me.Tracks.start();
    };

    me.playPause = me.Tracks.playPause;

    return me;
}(jQuery));

