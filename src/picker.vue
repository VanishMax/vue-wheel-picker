<template>
  <div
    class="picker"
    :style="{perspective: `${perspective}px`}"
    @mousedown="touchstart"
    @mouseup="touchend"
    @touchstart="touchstart"
    @touchend="touchend"
    @wheel="debounced"
    @keyup.up="animateToScroll(selectedIndex, selectedIndex - 1)"
    @keyup.down="animateToScroll(selectedIndex, selectedIndex + 1)"
    tabindex="0"
  >
    <div
      v-if="arrows"
      class="picker_arrow top"
      @click="animateToScroll(selectedIndex, selectedIndex - 1)"
    >
      <slot name="arrow-top" />
    </div>

    <div class="picker_wrapper">
      <ul class="picker_options" :style="listStyle">
        <li
          v-for="(item, i) in visibleOptions"
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
          <slot name="option" v-bind="item">
            {{ item.text }}
          </slot>
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
            v-for="(item, i) in visibleOptions"
            :key="i"
            class="picker_chosen_item"
            :style="`height: ${itemHeight}px`"
          >
            <slot name="option" v-bind="item">
              {{ item.text }}
            </slot>
          </li>
        </ul>
      </div>
    </div>

    <div
      v-if="arrows"
      class="picker_arrow bottom"
      @click="animateToScroll(selectedIndex, selectedIndex + 1)"
    >
      <slot name="arrow-bottom" />
    </div>
  </div>
</template>

<script lang="ts">
import Vue, { PropType } from 'vue';
import {
  calculateVelocity,
  easing,
  getVisibleOptions,
  isTouchEvent,
  MouseOrTouch,
  PickerValue,
  TouchDataType,
  wheelDebounce,
} from './utils';

export default Vue.extend({
  name: 'Picker',
  props: {
    /** An array of options in format { value: string, text: string } to be displayed in the Picker */
    options: {
      type: Array as PropType<PickerValue[]>,
      default: () => ([]),
    },

    /** Default value of the Picker. Use either as initial value or as a v-model */
    value: {
      type: Object as PropType<PickerValue|null>,
      default: null,
    },

    /** How far is each item in the list from another */
    radius: {
      type: Number,
      default: 150,
    },

    /** Defines 'how far is the Picker from the viewer'. Visually changes the circless-ness of the Picker. */
    perspective: {
      type: Number,
      default: 200,
    },

    /** The height of each item in the list. Needed to properly calculate the position of them */
    itemHeight: {
      type: Number,
      default: 40,
    },

    /**
     * How sensible is Picker for touches. The bigger value you put the more acceleration
     * the Picker gains after moving the touch.
     * Must be in the range from 0 to 10.
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

    /** Whether the arrows for scrolling to top or to bottom are needed to be displayed */
    arrows: {
      type: Boolean,
      default: false,
    },
  },

  model: {
    prop: 'value',
    event: 'change',
  },

  data () {
    const selected = this.value?.value ? this.options.findIndex((option) => option.value === this.value?.value) : 0;
    const selectedIndex = selected > -1 ? selected : 0;
    const options = getVisibleOptions(this.options, selectedIndex);
    // const circular = initCircularBuffer(this.options, selectedIndex);

    return {
      listStyle: {
        transform: `transform: translate3d(0, 0, ${-this.radius}px) rotateX(0deg)`,
      },
      highlightListStyle: {
        transform: `translate3d(0, 0, 0)`,
      },

      source: this.options, // Options {value: xx, text: xx}
      visibleOptions: options.options,
      visibleOptionsIndex: options.start,

      selected: this.value || this.options?.[0] || null,
      selectedIndex,
      prevSelectedIndex: selectedIndex,

      maxAcceleration: 10,
      requestAnimationId: 0,
      wheeling: false,

      touchData: {
        startY: 0,
        yArr: [],
        touchScroll: 0,
        delta: 0,
      } as TouchDataType,
    };
  },

  computed: {
    debounced (): Function {
      return wheelDebounce(this.wheel, this.endWheel, 100);
    },
    rotationAngle (): number {
      return 360 / this.visibleOptions.length;
    },
  },

  mounted () {
    document.addEventListener('mousedown', this.touchstart as EventListener);
    document.addEventListener('mouseup', this.touchend as EventListener);

    // Move to the initial value
    this.moveTo(this.selectedIndex);
  },

  watch: {
    value (val: PickerValue) {
      if (val?.value === this.selected?.value) return;

      const newIndex = val?.value ? this.source.findIndex((option) => option.value === this.value?.value) : 0;
      this.selected = val;
      if (this.selectedIndex !== newIndex) this.selectedIndex = newIndex;
      this.animateToScroll(this.selectedIndex, newIndex);
    },
  },

  methods: {
    changeSelectedIndex (newIndex: number) {
      if (Math.abs(newIndex - this.prevSelectedIndex) > this.visibleOptionsAmount / 2) {
        const options = getVisibleOptions(this.source, newIndex);
        this.visibleOptions = options.options;
        this.visibleOptionsIndex = options.start;
        this.prevSelectedIndex = this.selectedIndex;
      }
      this.selectedIndex = newIndex;
    },

    startRoll (yPos: number) {
      this.touchData.startY = yPos;
      this.touchData.yArr = [[yPos, new Date().getTime()]];
      this.touchData.touchScroll = this.selectedIndex;
      this.stop();
    },

    doRoll (yPos: number) {
      this.touchData.yArr.push([yPos, new Date().getTime()]);

      // Calculate new selected index by the item height and the scrolled amount
      const scrollAdd = (this.touchData.startY - yPos) / this.itemHeight;
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

    endRoll () {
      const velocity = calculateVelocity(this.touchData.yArr, this.itemHeight);
      this.changeSelectedIndex(this.touchData.touchScroll)
      this.animateMoveByVelocity(velocity);
    },

    touchstart (e: MouseOrTouch) {
      if (e.target) e.target.addEventListener('touchmove', this.touchmove as EventListener);
      document.addEventListener('mousemove', this.touchmove as EventListener);

      const eventY = isTouchEvent(e) ? e.touches[0].clientY : e.clientY;
      this.touchData.delta = 0;
      this.startRoll(eventY);
    },

    touchmove (e: MouseOrTouch) {
      e.preventDefault();

      const eventY = isTouchEvent(e) ? e.touches[0].clientY : e.clientY;
      this.doRoll(eventY);
    },

    wheel (e: WheelEvent) {
      e.preventDefault();

      if (!this.wheeling) {
        this.wheeling = true;
        const startPos = e.clientY;
        this.touchData.delta = e.deltaY;
        this.startRoll(startPos);
      } else {
        this.touchData.delta -= e.deltaY;
        this.doRoll(this.touchData.startY + this.touchData.delta);
      }
    },

    endWheel () {
      this.endRoll();
      this.wheeling = false;
    },

    touchend (e: TouchEvent) {
      if (e.target) e.target.removeEventListener('touchmove', this.touchmove as EventListener);
      document.removeEventListener('mousemove', this.touchmove as EventListener);
      this.endRoll();
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
        this.changeSelectedIndex(this.normalizeScroll(newIndex));
      }

      if (!this.source.length) {
        return 0;
      }

      this.listStyle.transform = `translate3d(0, 0, ${-this.radius}px) rotateX(${this.rotationAngle * (newIndex - this.visibleOptionsIndex)}deg)`;
      this.highlightListStyle.transform = `translate3d(0, ${-(newIndex - this.visibleOptionsIndex) * this.itemHeight}px, 0)`;

      this.visibleOptions = this.visibleOptions.map((item, index) => {
        item.visibility = Math.abs(this.visibleOptionsIndex + index - newIndex) <= this.visibleOptionsAmount / 2;
        return item;
      });

      return newIndex;
    },

    /**
     * At initial speed scroll (?) initV
     * @param {init} initV， initV Will be reset
     * To ensure scrolling to integers based on acceleration of scroll (Guaranteed to pass Scroll Target a selected value)
     */
    animateMoveByVelocity (initV: number) {
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

          this.animateToScroll(initScroll, finalScroll, t)?.then(() => this.selectByScroll(this.selectedIndex));
        } else {
          initScroll = this.selectedIndex;
          a = initV > 0 ? -this.sensitivity : this.sensitivity; // Is acceleration or deceleration
          t = Math.abs(initV / a); // Speed reduced to 0 takes time
          totalScrollLen = initV * t + a * t * t / 2; // Total rolling length
          finalScroll = Math.round(this.selectedIndex + totalScrollLen); // Round to ensure accuracy and finally scroll to an integer
          finalScroll = finalScroll < 0 ? 0 : (finalScroll > this.source.length - 1 ? this.source.length - 1 : finalScroll);

          totalScrollLen = finalScroll - initScroll;
          t = Math.sqrt(Math.abs(totalScrollLen / a));
          this.animateToScroll(this.selectedIndex, finalScroll, t)?.then(() => this.selectByScroll(this.selectedIndex));
        }
      } else {
        a = initV > 0 ? -this.sensitivity : this.sensitivity; // Deceleration/Acceleration
        t = Math.abs(initV / a); // Speed reduced to 0 takes time
        totalScrollLen = initV * t + a * t * t / 2; // Total rolling length
        finalScroll = Math.round(this.selectedIndex + totalScrollLen); // Round to ensure accuracy and finally scroll as an integer
        this.animateToScroll(this.selectedIndex, finalScroll, t)?.then(() => this.selectByScroll(this.selectedIndex));
      }
    },

    animateToScroll (initScroll: number, finalScroll: number, time: number|null = null) {
      if (finalScroll > this.source.length - 1 || finalScroll < 0) {
        return;
      }

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
            this.changeSelectedIndex(this.moveTo(initScroll + easing(pass / (time as number)) * totalScrollLen));
            this.requestAnimationId = requestAnimationFrame(tick);
          } else {
            resolve();
            this.stop();
            this.changeSelectedIndex(this.moveTo(initScroll + totalScrollLen));
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
.picker {
  position: relative;
  overflow-y: auto;
  overscroll-behavior: none;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.picker::-webkit-scrollbar {
  display: none;
}

.picker:focus {
  outline: none;
}

.picker_wrapper {
  position: relative;
  height: 100%;
  width: 100%;
  flex-grow: 1;
  overflow: hidden;
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
  width: 100%;
  transform: translate(0, -50%);
  overflow: hidden;
}

.picker_chosen_list {
  position: absolute;
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}

.picker_chosen_item, .picker_arrow {
  user-select: none;
}

.picker_arrow {
  cursor: pointer;
}
</style>
