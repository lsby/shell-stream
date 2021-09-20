import lib from '../dist/'
import * as tools from '@lsby/js_tools'

describe('基本测试', function () {
    it('测试1', async function () {
        this.timeout(99999999999)

        var p = await lib('cmd', {})
        await p.等待计算()

        await p.计算('dir')
        await p.计算('cd src')
        var r = await p.计算('dir')

        tools.断言相等(r.out.join('').indexOf('index.ts') != -1, true)

        p.进程.kill()
    })
})
