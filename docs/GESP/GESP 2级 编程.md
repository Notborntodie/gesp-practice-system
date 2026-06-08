# GESP 2级 编程手册

[TOC]

首先我们总结下GESP 2级中题型

## 题型总结

| 嵌套循环(画图)                    | 嵌套循环(枚举法)             | 数位拆分                   | 模拟                       |
| --------------------------------- | ---------------------------- | -------------------------- | -------------------------- |
| [GESP202509 二级] 菱形            | [GESP202512 二级]黄金格      | [GESP202412 二级] 数位和   | [GESP202503 二级] 时间跨越 |
| GESP202503 二级] 等差矩阵         | [GESP202509 二级] 优美的数字 | [GESP 二级]优美的数字      | [GESP202312 二级] 小杨做题 |
| [GESP202409 二级] 小杨的 N 字矩阵 | [GESP202506 二级] 幂和数     | [GESP202409 二级] 数位之和 | [GESP202309 二级] 数字黑洞 |
| [GESP202403 二级] 小杨的日字矩阵  | [GESP202506 二级] 数三角形   | [GESP202406 二级] 计数     |                            |
| [GESP202312 二级] 小杨的H字矩阵   | [GESP202412 二级] 寻找数字   | [GESP202309 二级] 数字黑洞 |                            |
| [GESP202309 二级] 小杨的 X 字矩阵 | [GESP202406 二级] 计数       |                            |                            |
| [GESP202303 二级] 画三角形        | [GESP202406 二级] 平方之和   |                            |                            |
|                                   | [GESP202306 二级] 自幂数判断 |                            |                            |
|                                   | [GESP202306 二级] 找素数     |                            |                            |
|                                   | [GESP202303 二级] 百鸡问题   |                            |                            |

下面结合真题介绍

1. 做题中使用数学函数
2. 数据类型的注意点
3. 数位拆分的模版和注意点
4. 嵌套循环(画图)的模版
5. 嵌套循环(枚举法)的注意点
6. 模拟题的注意点



## 数学函数的

由于函数的内容

下面是常见会用到数学函数，

| 函数名称   | abs(a)      | pow(a,b) | sqrt(a)      | ceil(a)     | round(a)    | max(a,b)         | min(a,b)         |
| ---------- | ----------- | -------- | ------------ | ----------- | ----------- | ---------------- | ---------------- |
| 函数功能   | 求a的绝对值 | 求$a^b$  | 求$\sqrt{a}$ | a的向上取整 | a的四舍五入 | 求a和b中的较大值 | 求a和b中的较小值 |
| 参数类型   | int         | double   | double       | double      | double      | int              | int              |
| 返回值类型 | int         | double   | double       | int         | int         | Int              | Int              |

例子

* 求绝对值

````c++
int a = -5;
int result = abs(a);
cout << "abs(" << a << ") = " << result << endl;  // 输出: abs(-5) = 5
````

* 求 a 的 b 次方

```c++
double a = 2.0;
double b = 3.0;
double result = pow(a, b);
cout << "pow(" << a << ", " << b << ") = " << result << endl;  // 输出: pow(2, 3) = 8
```

* 求平方根

```c++
double a = 16.0;
double result = sqrt(a);
cout << "sqrt(" << a << ") = " << result << endl;  // 输出: sqrt(16) = 4
```

*  向上取整

```c++
double a = 3.14;
int result = ceil(a);
cout << "ceil(" << a << ") = " << result << endl;  // 输出: ceil(3.14) = 4
```

*  四舍五入

```c++
double a = 3.5;
int result = round(a);
cout << "round(" << a << ") = " << result << endl;  // 输出: round(3.5) = 4
```

* 求较大值

```c++
int a = 10;
int b = 20;
int result = max(a, b);
cout << "max(" << a << ", " << b << ") = " << result << endl;  // 输出: max(10, 20) = 20
```

* 求较小值

```c++
int a = 10;
int b = 20;
int result = min(a, b);
cout << "min(" << a << ", " << b << ") = " << result << endl;  // 输出: min(10, 20) = 10
```



数学函数会在2级编程题中出现，但其实往往能借助其他方法而并不需要使用数学函数 , 

以 [GESP202506 二级] 幂和数 为例

<img src="/Users/zhengyanchen/Library/Application Support/typora-user-images/截屏2026-02-28 12.55.19.png" alt="截屏2026-02-28 12.55.19" style="zoom: 33%;" />

这道题通过枚举x 和y 找到 合适的n。因为出现了$2^x$ 和$2^y$, 所以可以使用$pow()$如下

```c++
#include<bits/stdc++.h>
using namespace std;
int main(){
    int l,r,cnt=0;
    cin>>l>>r;
    for(int x=0;x<=15;i++){
        for(int y=x;y<=15;y++){
            int n= pow(2,x)+pow(2,y);
            if(n<=r&&n>=l){
                cnt++;
            }
        }
    }
  	cout<<cnt;
}
```



但其实有一个更进阶的写法，避免了使用$pow$函数

**我们可以把$2^x$ 当成一个 整体$i$去进行枚举**，即$i=2^x$, 同样的，$j=2^y$

需要注意的是，这时候枚举的范围和步长都发生了变化，（为什么是这样的变化我们在**嵌套循环(枚举法)**会再详细讲）

```c++
#include<bits/stdc++.h>
using namespace std;
int main(){
    int l,r,cnt=0;
    cin>>l>>r;
    for(int i=1;i<=r;i*=2){
        for(int j=i;j<=r;j*=2){
            int n= i+j;
            if(n<=r&&n>=l){
                cnt++;
            }
        }
    }
  	cout<<cnt;
}
```

又比如在

 [GESP202512 二级]黄金格

![](/Users/zhengyanchen/Library/Application Support/typora-user-images/截屏2026-02-28 14.03.33.png)

$\sqrt{r^2+c^2}\le x+r-c$

一方面可以使用 `sqrt`函数，另外一方面也可以转化为

${r^2+c^2}\le (x+r-c)^2$ 避免了使用数学函数



**其他数学函数也都很有用处**。比如`abs`,`max`,`min`，但是如果你记不清楚用法，也可以转化成不使用数学函数的写法。



##  数据类型的注意点

这里主要是两方面

1. `long long`类型的使用 ，我们看下 [GESP202412 二级] 数位和 这道题，

<img src="/Users/zhengyanchen/Library/Application Support/typora-user-images/截屏2026-02-28 14.12.26.png" alt="截屏2026-02-28 14.12.26" style="zoom:33%;" />



这道题同学们很容易PAC,因为没注意到题目的要求

<img src="/Users/zhengyanchen/Library/Application Support/typora-user-images/截屏2026-02-28 14.15.35.png" alt="截屏2026-02-28 14.15.35" style="zoom: 33%;" />

int的表示范围使用是在$-2147483648$ 到 $$ 2147483647。$$

所以一般在$10^9$以上的数，我们都要用`long long`类型



2. 然后就是自动和强制类型转换

   

* 自动转换（隐式）

```C++
int a = 3.14;     // 自动: 3.14 → 3
double b = 5;     // 自动: 5 → 5.0
int c = 'A';      // 自动: 'A' → 65
double d = 7/2.0; // 自动: 7 → 7.0, 结果3.5
```

* 强制转换（显式）

```c++
double x = 9.87;
int y = (int)x;          
char ch=char(y);
```



比如这道  [GESP202303 二级] 画三角 就需要用到 

<img src="/Users/zhengyanchen/Library/Application Support/typora-user-images/截屏2026-02-28 14.20.20.png" alt="截屏2026-02-28 14.20.20" style="zoom:33%;" />

## 数位拆分的模版和注意点



数位拆分是用固定模版，典型的题目是

[GESP202412 二级] 数位和 和 [GESP202409 二级] 数位之和

对于一个`num` 来说，拆分模版如下

```c++
while(num!=0){
  int tmp=num%10;// 获取末位
  // 处理末位
  num/=10;  //去除末位
}
```

但是如果是嵌套循环，往往是有坑点

以  [GESP202406 二级] 计数  为例子

<img src="/Users/zhengyanchen/Library/Application Support/typora-user-images/截屏2026-02-28 14.44.46.png" alt="截屏2026-02-28 14.44.46" style="zoom:25%;" />



这道题，同学们做题很快就能意识到是要对1到n的每一个数进行数位拆分

写成下面

```C++
int cnt=0;//统计k出现次数
for(int i=1;i<=n;i++){
  while(i!=0){
  	int tmp=i%10;
    if (tmp==k){
      cnt++;
    }
    i/=10;
  }
}

```

这好像是符合我们的模版的，但是真的正确吗？

我们来想这样一个问题，在内部循环 ` while(i!=0)`结束以后。i会变成什么？ 是 0 ！！

i作为循环变量一旦被修改了，那么循环次数就会错了，所以我们怎么办呢？

我想大家已经想到了

```c++
int cnt=0;//统计k出现次数
for(int i=1;i<=n;i++){
  int j=i;
  while(j!=0){
  	int tmp=j%10;
    if (tmp==k){
      cnt++;
    }
    j/=10;
  }
}
```

没错，就是创建一个副本$j$。



## 嵌套循环(画图)

嵌套循环（画图）反而是最模版化的一类题目

* [GESP202409 二级] 小杨的 N 字矩阵

* [GESP202403 二级] 小杨的日字矩阵
* [GESP202309 二级] 小杨的 X 字矩阵
* [GESP202312 二级] 小杨的H字矩阵

都是一类题目

我们以 [GESP202409 二级] 小杨的 N 字矩阵 为例

<img src="/Users/zhengyanchen/Library/Application Support/typora-user-images/截屏2026-02-28 14.56.16.png" alt="截屏2026-02-28 14.56.16" style="zoom: 25%;" />

本质都是利用嵌套循环绘制一个$m*m$的矩阵

```c++
for(int i=1;i<=m;i++){ // 绘制m行 
  for(int j=1;j<=m;j++){ // 绘制m列
    if(j==1 || j==m || i==j){
    	cout<<"+";
    }else{
      cout<<"-";
    }
  }
  cout<<endl; // 内部循环结束，
}
```

* 其中的难点就在于对一个陌生的样式能不能找到 **行坐标$i$**和 **列坐标$j$**的规律

  

*  内部循环结束，意味着一行结束，需要加上换行



比较难找规律的是 [GESP202509 二级] 菱形

<img src="/Users/zhengyanchen/Library/Application Support/typora-user-images/截屏2026-02-28 15.07.19.png" alt="截屏2026-02-28 15.07.19" style="zoom:33%;" />

我们会发现所有#的 **行坐标$i$**和 **列坐标$j$** 到中间坐标(mid, mid)的 都是一样的，写成下面代码

```C++
// 计算中心点坐标（因为题目行列从1开始，所以中心是 (mid, mid)
int mid = (n + 1) / 2;
// 计算半径（中心到顶点的距离）
int r = n / 2;  
for (int i = 1; i <= n; i++) {
    for (int j = 1; j <= n; j++) {
        // 计算当前点 (i, j) 到中心点 (mid, mid) 的距离
        int distance = abs(i - mid) + abs(j - mid);
        // 如果距离等于半径，说明在菱形边框上
        if (distance == r) {
            cout << "#";
        } else {
            cout << ".";
        }
    }
    // 每行结束后换行
    cout << endl;
}
```





## 嵌套循环(枚举法)



首先我们回顾下枚举的关键点

1. 枚举的**范围**
2. 满足的**条件**，

如果你遇到需要去找满足什么条件的题目，你应该需要意识到这是枚举法，但是2级考察的枚举法基本需要使用嵌套循环，基本分为两类

### 枚举两个循环变量满足条件



这里题需要注意两点

1. 去重复
2. 枚举的范围大小



#### 去重复

比如 

[GESP202506 二级] 数三角形 和 [GESP202506 二级] 幂和数

<img src="/Users/zhengyanchen/Library/Application Support/typora-user-images/截屏2026-02-28 15.16.17.png" alt="截屏2026-02-28 15.16.17" style="zoom:33%;" />

 

这类题基本需要去枚举两个循环变量是否满足一定条件,  这里特别需要==**去重复**==

* 以 [GESP202506 二级] 数三角形 为例子，$2*3$ 和 $3*2$本质是同一种组合

[GESP202506 二级] 数三角形 

 ```c++
 int cnt=0;
 for(int a=1;a<=n;a++){
 	for(int b=a;b<=n;b++){ 
 		if((a*b)%2==0){
 				cnt++;
     }
   }
 }
 ```

我们的解决**去重复**方法就是 **改变内部循环的循环起点**

#### 枚举的范围大小

以  [GESP202506 二级] 幂和数 为例

<img src="/Users/zhengyanchen/Library/Application Support/typora-user-images/截屏2026-02-28 15.16.34.png" alt="截屏2026-02-28 15.16.34" style="zoom: 33%;" />



<img src="/Users/zhengyanchen/Library/Application Support/typora-user-images/截屏2026-02-28 15.32.35.png" alt="截屏2026-02-28 15.32.35" style="zoom: 33%;" />

$i=2^x$,  $j=2^y$ 需要考虑，枚举的范围，题目并没有直接告诉我们，但是我们可以**推理出来**

因为我们知道 $2^x+2^y=n$ ， $n \le r$, 所以 我们可以知道

*这里涉及到数学的放缩技巧*

$2^x \le r$

所以  $ i\le r$  ，因此我们设计的范围如下，同时因为$i=2^x$, 所以$i$的遍历如下

$2^0$  $2^1$ $2^2$  ....... 

所以for 循环步长设置为 `i*=2`

```c++
#include<bits/stdc++.h>
using namespace std;
int main(){
    int l,r,cnt=0;
    cin>>l>>r;
    for(int i=1;i<=r;i*=2){
        for(int j=i;j<=r;j*=2){
            int n= i+j;
            if(n<=r&&n>=l){
                cnt++;
            }
        }
    }
  	cout<<cnt;
}
```





### 枚举单个循环变量满足条件（另外一个循环变量表示数据规模）



这类题  [GESP202306 二级] 找素数 为典型

<img src="/Users/zhengyanchen/Library/Application Support/typora-user-images/截屏2026-02-28 15.38.50.png" alt="截屏2026-02-28 15.38.50" style="zoom:25%;" />

循环变量j只表示数据规模，并不参与条件判断。

大家要**关注flag的使用和位置**！！ 因为flag是用来判断一个素数的，所以要写在外层循环的里面，这样每次flag都会被重置为0

```c++
int cnt=0;
for(int j=A;j<=B;j++){  
	int flag=0;
  for(int i=2;i<=j-1;i++){
       if(n%i==0){
           flag=1;
         break
       }
  }
  if(flag){
      cnt++;
  }
}
```







## 模拟题

模拟题没有什么套路，比较考察学生的代码能力

我们用

[GESP202312 二级] 小杨做题 和  [GESP202309 二级] 数字黑洞

<img src="/Users/zhengyanchen/Library/Application Support/typora-user-images/截屏2026-03-01 14.39.30.png" alt="截屏2026-03-01 14.39.30" style="zoom: 33%;" />







