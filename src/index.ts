import { ChildProcess, exec } from 'child_process'
import spawn from 'cross-spawn'
import 日志管理者 from '@lsby/log_manage'
import 等待 from '@lsby/promise_wait'
import * as child_process from 'child_process'

function 字符串数组联合(arr: string[]) {
    return arr
        .join('')
        .trim()
        .replace(/\r/g, '')
        .split('\n')
        .filter((a) => a != '')
}

export default async function (
    cmd: string,
    opt: child_process.SpawnOptions,
    等待时间: number = 1000,
    日志缓冲行: number = 200,
) {
    var c = cmd.trim().replace(/  /g, ' ').split(' ')

    var 进程: ChildProcess = spawn(c[0], c.slice(1), opt)
    var 状态: '计算中' | '已结束' | '等待输入' = '计算中'
    var 退出码: number | null = null
    var 错误: Error | null = null
    var out日志 = 日志管理者(日志缓冲行)
    var err日志 = 日志管理者(日志缓冲行)
    var out定时器: null | NodeJS.Timeout = null
    var err定时器: null | NodeJS.Timeout = null

    if (进程.stdout == null) throw '创建失败'
    if (进程.stderr == null) throw '创建失败'
    if (进程.stdin == null) throw '创建失败'

    进程.on('close', (code) => {
        退出码 = code
        状态 = '已结束'
    })
    进程.on('error', (err) => {
        错误 = err
        状态 = '已结束'
    })
    进程.stdout.on('data', (data) => {
        if (out定时器 != null) clearTimeout(out定时器)
        状态 = '计算中'
        out日志.添加(data.toString())
        out定时器 = setTimeout(() => (状态 = '等待输入'), 等待时间)
    })
    进程.stderr.on('data', (data) => {
        if (err定时器 != null) clearTimeout(err定时器)
        状态 = '计算中'
        err日志.添加(data.toString())
        err定时器 = setTimeout(() => (状态 = '等待输入'), 等待时间)
    })

    var r = {
        进程: 进程,
        获取状态: () => 状态,
        获取退出码: () => 退出码,
        获取错误: () => 错误,
        等待计算: async () => {
            await 等待(() => 状态 != '计算中')
        },
        获取out日志: async () => {
            await 等待(() => 状态 != '计算中')
            return 字符串数组联合((await out日志.获得日志池()).map((a) => a.内容))
        },
        获取err日志: async () => {
            await 等待(() => 状态 != '计算中')
            return 字符串数组联合((await err日志.获得日志池()).map((a) => a.内容))
        },
        获取日志: async () => {
            await 等待(() => 状态 != '计算中')
            return {
                out: 字符串数组联合((await out日志.获得日志池()).map((a) => a.内容)),
                err: 字符串数组联合((await err日志.获得日志池()).map((a) => a.内容)),
            }
        },
        输入: async (_cmd: string, 回显: boolean = true) => {
            if (状态 == '已结束') throw '进程已结束'
            await 等待(() => 状态 == '等待输入')

            var cmd = _cmd[_cmd.length - 1] == '\n' ? _cmd : _cmd + '\n'
            if (回显) {
                await out日志.追加(cmd)
            }

            状态 = '计算中'
            进程.stdin?.write(cmd)
        },
        计算: async (_cmd: string, 回显: boolean = true) => {
            if (状态 == '已结束') throw '进程已结束'
            await 等待(() => 状态 == '等待输入')

            var cmd = _cmd[_cmd.length - 1] == '\n' ? _cmd : _cmd + '\n'
            if (回显) {
                await out日志.追加(cmd)
            }

            var out缓存: string[] = []
            var err缓存: string[] = []

            out日志.当变化后(async (s) => {
                out缓存.push(s)
            })
            err日志.当变化后(async (s) => {
                err缓存.push(s)
            })

            状态 = '计算中'
            进程.stdin?.write(cmd)
            await r.等待计算()

            out日志.取消变化监听()
            err日志.取消变化监听()

            return {
                out: 字符串数组联合(out缓存),
                err: 字符串数组联合(err缓存),
            }
        },
    }
    return r
}
