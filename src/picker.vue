<template>
  <div
    class="picker"
    @mousedown="touchstart"
    @mouseup="touchend"
    @touchstart="touchstart"
    @touchend="touchend"
  >
    <div class="picker_wrapper">
      <ul class="picker_options" :style="listStyle">
        <li
          v-for="(item, i) in source"
          :key="item.value"
          class="picker_option"
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
        class="picker_chosen"
        :style="{
          height: `${itemHeight}px`,
          'line-height': `${itemHeight}px`,
        }"
      >
        <ul class="picker_chosen_list" :style="highlightListStyle">
          <li
            v-for="(item, i) in options"
            :key="i"
            class="picker_chosen_item"
            :style="`height: ${itemHeight}px`"
          >
            {{ item.text }}
          </li>
        </ul>
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

/** EaseOutQuart easing function */
const easing = (pos: number) => {
  return -(Math.pow((pos - 1), 4) - 1);
};

export default Vue.extend({
  name: 'Picker',
  props: {
    /** An array of options in format { value: string, text: string } to be displayed in the Picker */
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

    /**
     * How sensible is Picker for touches. The bigger value you put, the more acceleration
     * the picker gains after moving the touch.
     * Must be in range from 0 to 10.
     */
    sensitivity: {
      type: Number,
      default: 8,
      validator: function (value) {
        return value > 0 && value <= 10;
      },
    },

    /**
     * Amount of options that are visible on the ring of a Picker.
     * At maximum, will display passed amount plus one chosen option in the center of the ring.
     * Must be a multiple of 2 for the best experience.
     */
    visibleOptionsAmount: {
      type: Number,
      default: 10,
      validator: function (value) {
        return value % 2 === 0;
      }
    },

    /** If 'infinite' is passed, then you can scroll the Picker forever, all values will repeat */
    type: {
      type: String as PropType<'normal' | 'infinite'>,
      default: 'normal',
      validator: function (value) {
        return ['normal', 'infinite'].includes(value);
      }
    },
  },

  model: {
    prop: 'value',
    event: 'change',
  },

  data () {
    return {
      listStyle: {
        transform: `transform: translate3d(0, 0, ${-this.radius}px) rotateX(0deg)`,
      },
      highlightListStyle: {
        transform: `translate3d(0, 0, 0)`,
      },

      source: this.options, // Options {value: xx, text: xx}
      selected: this.value || this.options?.[0] || null,
      selectedIndex: this.value?.value ? this.options.findIndex((option) => option.value === this.value?.value) : 0,

      maxAcceleration: 10,
      requestAnimationId: 0,

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
    document.addEventListener('mousedown', this.touchstart);
    document.addEventListener('mouseup', this.touchend);

    // Move to the initial value
    this.animateToScroll(0, this.selectedIndex);
  },

  watch: {
    value (val: PickerValue) {
      if (val?.value === this.selected?.value) return;

      const newIndex = val?.value ? this.source.findIndex((option) => option.value === this.value?.value) : 0;
      this.selected = val;
      this.selectedIndex = newIndex;
      this.animateToScroll(this.selectedIndex, newIndex);
    },
  },

  methods: {
    touchstart (e: MouseOrTouch) {
      if (e.target) e.target.addEventListener('touchmove', this.touchmove);
      document.addEventListener('mousemove', this.touchmove);

      const eventY = isTouchEvent(e) ? e.touches[0].clientY : e.clientY;
      this.touchData.startY = eventY;
      this.touchData.yArr = [[eventY, new Date().getTime()]];
      this.touchData.touchScroll = this.selectedIndex;
      this.stop();
    },

    touchmove (e: MouseOrTouch) {
      const eventY = isTouchEvent(e) ? e.touches[0].clientY : e.clientY;
      this.touchData.yArr.push([eventY, new Date().getTime()]);

      // Calculate new selected index by the item height and the scrolled amount
      const scrollAdd = (this.touchData.startY - eventY) / this.itemHeight;
      let moveToScroll = scrollAdd + this.selectedIndex;

      if (this.type === 'normal') {
        if (moveToScroll < 0) {
          moveToScroll *= 0.3;
        } else if (moveToScroll > this.source.length) {
          moveToScroll = this.source.length + (moveToScroll - this.source.length) * 0.3;
        }
      } else {
        moveToScroll = this.normalizeScroll(moveToScroll);
      }

      this.touchData.touchScroll = this.moveTo(moveToScroll);
    },

    touchend (e: TouchEvent) {
      if (e.target) e.target.removeEventListener('touchmove', this.touchmove);
      document.removeEventListener('mousemove', this.touchmove);

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

      this.selectedIndex = this.touchData.touchScroll;
      this.animateMoveByVelocity(velocity);
    },

    normalizeScroll (scroll: number): number {
      let normalizedScroll = scroll;

      while (normalizedScroll < 0) {
        normalizedScroll += this.source.length;
      }
      normalizedScroll = normalizedScroll % this.source.length;

      return normalizedScroll;
    },

    /** Immediate move to some index in the options array */
    moveTo (newIndex: number): number {
      if (this.type === 'infinite') {
        this.selectedIndex = this.normalizeScroll(newIndex);
      }

      if (!this.source.length) {
        return 0;
      }

      this.listStyle.transform = `translate3d(0, 0, ${-this.radius}px) rotateX(${this.rotationAngle * newIndex}deg)`;
      this.highlightListStyle.transform = `translate3d(0, ${-(newIndex) * this.itemHeight}px, 0)`;

      this.source = this.source.map((item, index) => {
        item.visibility = Math.abs(index - newIndex) <= this.visibleOptionsAmount / 2;
        return item;
      });

      return newIndex;
    },

    /**
     * At initial speed scroll (?) initV
     * @param {init} initV， initV Will be reset
     * To ensure scrolling to integers based on acceleration of scroll (Guaranteed to pass Scroll Target a selected value)
     */
    async animateMoveByVelocity (initV: number) {
      let initScroll;
      let finalScroll;
      let totalScrollLen;

      let a; // Acceleration
      let t; // Time

      if (this.type === 'normal') {
        if (this.selectedIndex < 0 || this.selectedIndex > this.source.length - 1) {
          a = this.maxAcceleration;
          initScroll = this.selectedIndex;
          finalScroll = this.selectedIndex < 0 ? 0 : this.source.length - 1;
          totalScrollLen = initScroll - finalScroll;
          t = Math.sqrt(Math.abs(totalScrollLen / a));

          await this.animateToScroll(initScroll, finalScroll, t);
        } else {
          initScroll = this.selectedIndex;
          a = initV > 0 ? -this.sensitivity : this.sensitivity; // Is acceleration or deceleration
          t = Math.abs(initV / a); // Speed reduced to 0 takes time
          totalScrollLen = initV * t + a * t * t / 2; // Total rolling length
          finalScroll = Math.round(this.selectedIndex + totalScrollLen); // Round to ensure accuracy and finally scroll to an integer
          finalScroll = finalScroll < 0 ? 0 : (finalScroll > this.source.length - 1 ? this.source.length - 1 : finalScroll);

          totalScrollLen = finalScroll - initScroll;
          t = Math.sqrt(Math.abs(totalScrollLen / a));
          await this.animateToScroll(this.selectedIndex, finalScroll, t);
        }
      } else {
        a = initV > 0 ? -this.sensitivity : this.sensitivity; // Deceleration/Acceleration
        t = Math.abs(initV / a); // Speed reduced to 0 takes time
        totalScrollLen = initV * t + a * t * t / 2; // Total rolling length
        finalScroll = Math.round(this.selectedIndex + totalScrollLen); // Round to ensure accuracy and finally scroll as an integer
        await this.animateToScroll(this.selectedIndex, finalScroll, t);
      }

      this.selectByScroll(this.selectedIndex);
    },

    animateToScroll (initScroll: number, finalScroll: number, time: number|null = null) {
      if (time === null) {
        time = 0.125 * (Math.abs(finalScroll - initScroll));
      }

      if (initScroll === finalScroll || time === 0) {
        this.moveTo(initScroll);

        return;
      }

      const start = new Date().getTime() / 1000;
      let pass = 0;
      const totalScrollLen = finalScroll - initScroll;

      return new Promise<void>((resolve) => {
        const tick = () => {
          pass = new Date().getTime() / 1000 - start;

          if (pass < (time as number)) {
            this.selectedIndex = this.moveTo(initScroll + easing(pass / (time as number)) * totalScrollLen);
            this.requestAnimationId = requestAnimationFrame(tick);
          } else {
            resolve();
            this.stop();
            this.selectedIndex = this.moveTo(initScroll + totalScrollLen);
          }
        };
        tick();
      });
    },

    stop () {
      cancelAnimationFrame(this.requestAnimationId);
    },

    selectByScroll (scroll: number) {
      scroll = this.normalizeScroll(scroll) | 0;
      if (scroll > this.source.length - 1) {
        scroll = this.source.length - 1;
        this.moveTo(scroll);
      }

      this.moveTo(scroll);
      this.selectedIndex = scroll;
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

.picker {
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

.picker_wrapper {
  flex: 1;
  position: relative;
  height: 100%;
  text-align: center;
  overflow: hidden;
  font-size: 18px;
  color: #ddd;
}

.picker_wrapper:before, .picker_wrapper:after {
  position: absolute;
  z-index: 1;
  display: block;
  content: '';
  width: 100%;
  height: 50%;
  pointer-events: none;
}

.picker_wrapper:before {
  top: 0;
  background-image: linear-gradient(to bottom, rgba(1, 1, 1, 0.5), rgba(1, 1, 1, 0));
}

.picker_wrapper:after {
  bottom: 0;
  background-image: linear-gradient(to top, rgba(1, 1, 1, 0.5), rgba(1, 1, 1, 0));
}

.picker_options {
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

.picker_option {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 50px;
  user-select: none;
  -webkit-font-smoothing: subpixel-antialiased;
}

.picker_chosen {
  position: absolute;
  top: 50%;
  transform: translate(0, -50%);
  width: 100%;
  background-color: #000;
  border-top: 1px solid #333;
  border-bottom: 1px solid #333;
  font-size: 20px;
  overflow: hidden;
}

.picker_chosen_list {
  position: absolute;
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}

.picker_chosen_item {
  user-select: none;
}
</style>
