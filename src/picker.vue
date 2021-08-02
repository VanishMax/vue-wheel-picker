<template>
  <div
    class="date-selector"
    @mousedown="_touchstart"
    @mouseup="_touchend"
    @touchstart="_touchstart"
    @touchend="_touchend"
  >
    <div class="year" id="year1">
      <div class="select-wrap">
        <ul class="select-options" :style="listStyle">
          <li
            v-for="(item, i) in source"
            :key="item.value"
            class="select-option"
            :style="{
              top: `${itemHeight * -0.5}px`,
              height: `${itemHeight}px`,
              'line-height': `${itemHeight}px`,
              transform: `rotateX(${-rotationAngle * i}deg) translate3d(0, 0, ${radius}px)`,
              visibility: item.visibility ? 'visible' : 'hidden',
            }"
            :data-index="i"
          >
            {{ item.text }}
          </li>
        </ul>

        <div
          class="highlight"
          :style="{
            height: `${itemHeight}px`,
            'line-height': `${itemHeight}px`,
          }"
        >
          <ul class="highlight-list" :style="highlightListStyle">
            <li
              v-for="(item, i) in options"
              class="highlight-item"
              :style="`height: ${itemHeight}px`"
            >
              {{ item.text }}
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue, { PropType } from 'vue';

export type PickerValue = {
  value: string,
  text: string,
  visibility?: boolean,
}

export type TouchDataType = {
  startY: number,
  yArr: (number[])[],
  touchScroll: number,
};

type EventNames = 'touchstart'|'touchmove'|'touchend';

interface MouseEvents extends MouseEvent {
  type: 'mousedown'|'mousemove'|'mouseup',
}

interface TouchEvents extends TouchEvent {
  type: EventNames,
}

type MouseOrTouch = MouseEvents | TouchEvents;

const isTouchEvent = (evt: MouseOrTouch): evt is TouchEvents => ['touchstart', 'touchmove', 'touchend'].includes(evt.type);

const easing = {
  easeOutCubic (pos: number) {
    return (Math.pow((pos - 1), 3) + 1);
  },
  easeOutQuart (pos: number) {
    return -(Math.pow((pos - 1), 4) - 1);
  },
};

export default Vue.extend({
  name: 'Picker', // vue component name
  props: {
    options: {
      type: Array as PropType<PickerValue[]>,
      default: () => ([]),
    },
    value: {
      type: Object as PropType<PickerValue|null>,
      default: null,
    },
    radius: {
      type: Number,
      default: 150,
    },
    itemHeight: {
      type: Number,
      default: 40,
    },
    sensitivity: {
      type: Number,
      default: 0.8,
    },

    /**
     * Amount of options that are visible on the ring of a Picker.
     * At maximum, will display passed amount plus one chosen option in the center of the ring.
     * Must be a multiple of 2 for the best experience.
     */
    visibleOptionsAmount: {
      type: Number,
      default: 10,
    },

    type: {
      type: String as PropType<'normal' | 'infinite'>,
      default: 'normal',
    }
  },

  model: {
    prop: 'value',
    event: 'change',
  },

  data () {
    const a = this.sensitivity * 10;
    const minV = Math.sqrt(1 / a);

    return {
      listStyle: {
        transform: `transform: translate3d(0, 0, ${-this.radius}px) rotateX(0deg)`,
      },
      highlightListStyle: {
        transform: `translate3d(0, 0, 0)`,
      },

      source: this.options, // Options {value: xx, text: xx}
      onChange: null,

      a, // Scroll deceleration (0.8 is sensitivity)
      minV, // Minimal initial velocity

      val: this.value || this.options?.[0] || null,
      selected: this.value || this.options?.[0] || null,

      exceedA: 10, // Is deceleration exceeded
      moveT: 0, // Scroll tick
      scroll: this.value ? this.options.findIndex((option) => option.value === this.value?.value) : 0,

      touchData: {
        startY: 0,
        yArr: [],
        touchScroll: 0,
      } as TouchDataType,
    };
  },

  computed: {
    rotationAngle (): number {
      return 360 / this.source.length;
    },
  },

  mounted () {
    document.addEventListener('mousedown', this._touchstart);
    document.addEventListener('mouseup', this._touchend);
    this._selectByScroll(this.scroll);
  },

  methods: {
    _touchstart (e: MouseOrTouch) {
      if (e.target) e.target.addEventListener('touchmove', this._touchmove);
      document.addEventListener('mousemove', this._touchmove);

      const eventY = isTouchEvent(e) ? e.touches[0].clientY : e.clientY;
      this.touchData.startY = eventY;
      this.touchData.yArr = [[eventY, new Date().getTime()]];
      this.touchData.touchScroll = this.scroll;
      this._stop();
    },

    _touchmove (e: MouseOrTouch) {
      const eventY = isTouchEvent(e) ? e.touches[0].clientY : e.clientY;
      this.touchData.yArr.push([eventY, new Date().getTime()]);

      const scrollAdd = (this.touchData.startY - eventY) / this.itemHeight;
      let moveToScroll = scrollAdd + this.scroll;

      // When scrolling is not infinite, out of range makes scrolling difficult
      if (this.type === 'normal') {
        if (moveToScroll < 0) {
          moveToScroll *= 0.3;
        } else if (moveToScroll > this.source.length) {
          moveToScroll = this.source.length + (moveToScroll - this.source.length) * 0.3;
        }
      } else {
        moveToScroll = this._normalizeScroll(moveToScroll);
      }

      this.touchData.touchScroll = this._moveTo(moveToScroll);
    },

    _touchend (e: TouchEvent) {
      if (e.target) e.target.removeEventListener('touchmove', this._touchmove);
      document.removeEventListener('mousemove', this._touchmove);

      let velocity;

      if (this.touchData.yArr.length === 1) {
        velocity = 0;
      } else {
        const startTime = this.touchData.yArr[this.touchData.yArr.length - 2][1];
        const endTime = this.touchData.yArr[this.touchData.yArr.length - 1][1];
        const startY = this.touchData.yArr[this.touchData.yArr.length - 2][0];
        const endY = this.touchData.yArr[this.touchData.yArr.length - 1][0];

        // Calculated speed
        velocity = ((startY - endY) / this.itemHeight) * 1000 / (endTime - startTime);
        const sign = velocity > 0 ? 1 : -1;

        velocity = Math.abs(velocity) > 30 ? 30 * sign : velocity;
      }

      this.scroll = this.touchData.touchScroll;
      this._animateMoveByVelocity(velocity);
    },

    _normalizeScroll (scroll: number): number {
      let normalizedScroll = scroll;

      while (normalizedScroll < 0) {
        normalizedScroll += this.source.length;
      }
      normalizedScroll = normalizedScroll % this.source.length;

      return normalizedScroll;
    },

    _moveTo (scroll: number): number {
      if (this.type === 'infinite') {
        this.scroll = this._normalizeScroll(scroll);
      }

      if (!this.source.length) {
        return 0;
      }

      this.listStyle.transform = `translate3d(0, 0, ${-this.radius}px) rotateX(${this.rotationAngle * scroll}deg)`;
      this.highlightListStyle.transform = `translate3d(0, ${-(scroll) * this.itemHeight}px, 0)`;

      this.source = this.source.map((item, index) => {
        item.visibility = Math.abs(index - scroll) <= this.visibleOptionsAmount / 2;
        return item;
      });

      return scroll;
    },

    /**
     * At initial speed scroll (?) initV
     * @param {init} initV， initV Will be reset
     * To ensure scrolling to integers based on acceleration of scroll (Guaranteed to pass Scroll Target a selected value)
     */
    async _animateMoveByVelocity (initV: number) {
      let initScroll;
      let finalScroll;

      let totalScrollLen;
      let a;
      let t;

      if (this.type === 'normal') {
        if (this.scroll < 0 || this.scroll > this.source.length - 1) {
          a = this.exceedA;
          initScroll = this.scroll;
          finalScroll = this.scroll < 0 ? 0 : this.source.length - 1;
          totalScrollLen = initScroll - finalScroll;
          t = Math.sqrt(Math.abs(totalScrollLen / a));

          await this._animateToScroll(initScroll, finalScroll, t);
        } else {
          initScroll = this.scroll;
          a = initV > 0 ? -this.a : this.a; // Is acceleration or deceleration
          t = Math.abs(initV / a); // Speed reduced to 0 takes time
          totalScrollLen = initV * t + a * t * t / 2; // Total rolling length
          finalScroll = Math.round(this.scroll + totalScrollLen); // Round to ensure accuracy and finally scroll to an integer
          finalScroll = finalScroll < 0 ? 0 : (finalScroll > this.source.length - 1 ? this.source.length - 1 : finalScroll);

          totalScrollLen = finalScroll - initScroll;
          t = Math.sqrt(Math.abs(totalScrollLen / a));
          await this._animateToScroll(this.scroll, finalScroll, t, 'easeOutQuart');
        }
      } else {
        a = initV > 0 ? -this.a : this.a; // Deceleration/Acceleration
        t = Math.abs(initV / a); // Speed reduced to 0 takes time
        totalScrollLen = initV * t + a * t * t / 2; // Total rolling length
        finalScroll = Math.round(this.scroll + totalScrollLen); // Round to ensure accuracy and finally scroll as an integer
        await this._animateToScroll(this.scroll, finalScroll, t, 'easeOutQuart');
      }

      this._selectByScroll(this.scroll);
    },

    _animateToScroll (initScroll: number, finalScroll: number, time: number, easingName: keyof typeof easing = 'easeOutQuart') {
      if (initScroll === finalScroll || time === 0) {
        this._moveTo(initScroll);

        return;
      }

      const start = new Date().getTime() / 1000;
      let pass = 0;
      const totalScrollLen = finalScroll - initScroll;

      return new Promise<void>((resolve) => {
        const tick = () => {
          pass = new Date().getTime() / 1000 - start;

          if (pass < time) {
            this.scroll = this._moveTo(initScroll + easing[easingName](pass / time) * totalScrollLen);
            this.moveT = requestAnimationFrame(tick);
          } else {
            resolve();
            this._stop();
            this.scroll = this._moveTo(initScroll + totalScrollLen);
          }
        };
        tick();
      });
    },

    _stop () {
      cancelAnimationFrame(this.moveT);
    },

    _selectByScroll (scroll: number) {
      scroll = this._normalizeScroll(scroll) | 0;
      if (scroll > this.source.length - 1) {
        scroll = this.source.length - 1;
        this._moveTo(scroll);
      }

      this._moveTo(scroll);
      this.scroll = scroll;
      this.selected = this.source[scroll];
      this.$emit('change', this.selected);
    }
  },
});
</script>

<style>
body {
  font-family: Arial sans-serif;
  background: #000;
}

.select-wrap {
  position: relative;
  height: 100%;
  text-align: center;
  overflow: hidden;
  font-size: 20px;
  color: #ddd;
}

.select-wrap:before, .select-wrap:after {
  position: absolute;
  z-index: 1;
  display: block;
  content: '';
  width: 100%;
  height: 50%;
}

.select-wrap:before {
  top: 0;
  background-image: linear-gradient(to bottom, rgba(1, 1, 1, 0.5), rgba(1, 1, 1, 0));
}

.select-wrap:after {
  bottom: 0;
  background-image: linear-gradient(to top, rgba(1, 1, 1, 0.5), rgba(1, 1, 1, 0));
}

.select-wrap .select-options {
  position: absolute;
  top: 50%;
  left: 0;
  width: 100%;
  height: 0;
  transform-style: preserve-3d;
  margin: 0 auto;
  padding: 0 0;
  display: block;
  transform: translateZ(-150px) rotateX(0deg);
  -webkit-font-smoothing: subpixel-antialiased;
  color: #666;
  list-style: none;
}

.select-wrap .select-option {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 50px;
  user-select: none;
  -webkit-font-smoothing: subpixel-antialiased;
}

/*@for $i from 1 through 100 {
  &:nth-child(#{$i}) {
    transform: rotateX(-18deg * ($i - 1)) translateZ(150px);
  }
}*/

.highlight {
  position: absolute;
  top: 50%;
  transform: translate(0, -50%);
  width: 100%;
  background-color: #000;
  border-top: 1px solid #333;
  border-bottom: 1px solid #333;
  font-size: 24px;
  overflow: hidden;
}

.highlight-list {
  position: absolute;
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}

.highlight-list li {
  user-select: none;
}

.date-selector {
  position: absolute;
  left: 50%;
  top: 50%;
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  width: 600px;
  height: 300px;
  transform: translate(-50%, -50%);
  perspective: 2000px;
}

.date-selector > div {
  flex: 1;
}

.date-selector .select-wrap {
  font-size: 18px;
}

.date-selector .highlight {
  font-size: 20px;
}
</style>
