/**
 * 自定义渐变扩展
 * 在运行时扩展3Dmol的渐变功能，无需重新编译3Dmol.js
 */

(function() {
    // 等待3Dmol加载完成
    if (typeof $3Dmol === 'undefined') {
        console.warn('3Dmol.js未加载，无法注册自定义渐变');
        return;
    }

    // 检查Gradient对象是否存在
    if (typeof $3Dmol.Gradient === 'undefined') {
        console.warn('$3Dmol.Gradient未定义，无法注册自定义渐变');
        return;
    }

    /**
     * BWR (Blue-White-Red) 渐变类
     * 与RWB相反：蓝色 -> 白色 -> 红色
     */
    function BWR(min, max, mid) {
        this.gradient = "BWR";
        this.mult = 1.0;
        this.mid = mid;
        
        // 处理参数
        if (typeof max === "undefined" && Array.isArray(min) && min.length >= 2) {
            // 传入的是单个范围数组
            this.max = min[1];
            this.min = min[0];
        } else if (min !== undefined && max !== undefined && !Array.isArray(min)) {
            this.min = min;
            this.max = max;
        } else {
            this.min = min || -1;
            this.max = max || 1;
        }
    }

    // 继承GradientType的方法（如果存在）
    if ($3Dmol.Gradient.prototype) {
        BWR.prototype = Object.create($3Dmol.Gradient.prototype);
    }
    BWR.prototype.constructor = BWR;

    // 返回颜色映射的范围
    BWR.prototype.range = function() {
        if (typeof this.min !== "undefined" && typeof this.max !== "undefined") {
            return [this.min, this.max];
        }
        return null;
    };

    // 将值映射为十六进制颜色
    BWR.prototype.valueToHex = function(val, range) {
        var lo, hi;
        val = this.mult * val; // 反转（如果需要）
        
        if (range) {
            lo = range[0];
            hi = range[1];
        } else {
            lo = this.min;
            hi = this.max;
        }

        if (val === undefined) return 0xffffff;

        // 标准化值（使用3Dmol的normalizeValue函数，如果不存在则自己实现）
        var normalizeValue = $3Dmol.Gradient.normalizeValue || function(lo, hi, val) {
            if (lo > hi) {
                return { lo: hi, hi: lo, val: val };
            }
            return { lo: lo, hi: hi, val: val };
        };
        var norm = normalizeValue(lo, hi, val);
        lo = norm.lo;
        hi = norm.hi;
        val = norm.val;

        // 计算中点
        var middle = (hi + lo) / 2;
        if (range && typeof range[2] !== "undefined") {
            middle = range[2];
        } else if (typeof this.mid !== "undefined") {
            middle = this.mid; // 允许用户指定中点
        } else {
            middle = (lo + hi) / 2;
        }

        var scale, color;

        // 从蓝色渐变到白色 (val < middle)
        if (val < middle) {
            scale = Math.floor(255 * Math.sqrt((val - lo) / (middle - lo)));
            // 蓝色(0x0000ff) -> 白色(0xffffff)
            color = 0x0000ff + 0x10000 * scale + 0x100 * scale;
            return color;
        } else if (val > middle) {
            // 从白色渐变到红色 (val > middle)
            scale = Math.floor(255 * Math.sqrt(1 - (val - middle) / (hi - middle)));
            // 白色(0xffffff) -> 红色(0xff0000)
            color = 0xff0000 + 0x100 * scale + scale;
            return color;
        } else {
            // val == middle，返回白色
            return 0xffffff;
        }
    };

    // 注册BWR渐变到builtinGradients
    if (!$3Dmol.Gradient.builtinGradients) {
        $3Dmol.Gradient.builtinGradients = {};
    }
    
    $3Dmol.Gradient.builtinGradients["bwr"] = BWR;
    $3Dmol.Gradient.builtinGradients["BWR"] = BWR;

    // 如果Gradient类有静态属性，也添加进去
    if ($3Dmol.Gradient.BWR === undefined) {
        $3Dmol.Gradient.BWR = BWR;
    }

    console.log('BWR渐变已成功注册到3Dmol');
})();

