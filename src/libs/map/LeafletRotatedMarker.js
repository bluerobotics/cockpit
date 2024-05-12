/* eslint-disable no-undef */
// Original source: https://github.com/osimek1/Leaflet.RotatedMarker
// License: MIT

;(function (factory) {
  let L
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['leaflet'], factory)
  } else if (typeof module === 'object' && typeof module.exports === 'object') {
    // Node/CommonJS
    L = require('leaflet')
    module.exports = factory(L)
  } else {
    // Browser globals
    if (typeof window.L === 'undefined') throw 'Leaflet must be loaded first'
    factory(window.L)
  }
})(function (L) {
  // save these original methods before they are overwritten
  const proto_initIcon = L.Marker.prototype._initIcon
  const proto_setPos = L.Marker.prototype._setPos

  const oldIE = L.DomUtil.TRANSFORM === 'msTransform'

  L.Marker.addInitHook(function () {
    const iconOptions = this.options.icon && this.options.icon.options
    let iconAnchor = iconOptions && this.options.icon.options.iconAnchor
    if (iconAnchor) {
      iconAnchor = iconAnchor[0] + 'px ' + iconAnchor[1] + 'px'
    }
    this.options.rotationOrigin = this.options.rotationOrigin || iconAnchor || 'center bottom'
    this.options.rotationAngle = this.options.rotationAngle || 0

    // Ensure marker keeps rotated during dragging
    this.on('drag', function (e) {
      e.target._applyRotation()
    })
  })

  L.Marker.include({
    _initIcon: function () {
      proto_initIcon.call(this)
    },

    _setPos: function (pos) {
      proto_setPos.call(this, pos)
      this._applyRotation()
    },

    _applyRotation: function () {
      if (this.options.rotationAngle) {
        this._icon.style[L.DomUtil.TRANSFORM + 'Origin'] = this.options.rotationOrigin

        if (oldIE) {
          // for IE 9, use the 2D rotation
          this._icon.style[L.DomUtil.TRANSFORM] = 'rotate(' + this.options.rotationAngle + 'deg)'
        } else {
          // for modern browsers, prefer the 3D accelerated version
          this._icon.style[L.DomUtil.TRANSFORM] += ' rotateZ(' + this.options.rotationAngle + 'deg)'
        }
      }
    },

    setRotationAngle: function (angle) {
      this.options.rotationAngle = angle
      this.update()
      return this
    },

    setRotationOrigin: function (origin) {
      this.options.rotationOrigin = origin
      this.update()
      return this
    },
  })
})
