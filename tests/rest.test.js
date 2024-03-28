const { Endpoints } = require('../disjs/endpoints');
const {RESTError, REST, HTTPClient, HTTPResponse} = require('../disjs/rest');

const samples = [
    {
        "code": 50035,
        "errors": {
            "activities": {
                "0": {
                    "platform": {
                        "_errors": [
                            {
                                "code": "BASE_TYPE_CHOICES",
                                "message": "Value must be one of ('desktop', 'android', 'ios')."
                            }
                        ]
                    },
                    "type": {
                        "_errors": [
                            {
                                "code": "BASE_TYPE_CHOICES",
                                "message": "Value must be one of (0, 1, 2, 3, 4, 5)."
                            }
                        ]
                    }
                }
            }
        },
        "message": "Invalid Form Body"
    },
    {
        "code": 50035,
        "errors": {
            "access_token": {
                "_errors": [
                    {
                        "code": "BASE_TYPE_REQUIRED",
                        "message": "This field is required"
                    }
                ]
            }
        },
        "message": "Invalid Form Body"
    },
    {
        "code": 50035,
        "message": "Invalid Form Body",
        "errors": {
            "_errors": [
                {
                    "code": "APPLICATION_COMMAND_TOO_LARGE",
                    "message": "Command exceeds maximum size (8000)"
                }
            ]
        }
    },
];

class MockHTTPResponse extends HTTPResponse {
    async json() {
        return JSON.parse(await this.text());
    }
    getHeader(name) {
        return {
            'content-type': 'application/json'
        }[name.toLowerCase()];
    }
};

class MockHTTPClient extends HTTPClient {
    constructor(state) {
        super();
        this.state = state;
    }

    async perform(url, options) {
        switch (this.state) {
        case 'basic':
            expect(url).toBe('https://discord.com/api/v10/gateway');
            expect(options.headers.Authorization).toBe('Bot AAAA.BBBB.CCCC');
            expect(options.headers['User-Agent']).toMatch(/^DiscordBot \(https:\/\/github.com\/DarpHome\/disjs, 1\.0\.0\) node\/(.*)$/);
            return new class extends MockHTTPResponse {
                async json() {
                    return {
                        url: 'wss://gateway.discord.gg'
                    };
                }
            
                get status() {
                    return 200;
                }
            };
        case 'forbidden':
            return new class extends MockHTTPResponse {
                async json() {
                    return {
                        code: 50001,
                        message: 'Missing Access',
                    };
                }
            
                get status() {
                    return 403;
                }
            }
        }
    }
}

describe('RESTError', () => {
    test('parses samples', () => {
        expect(new RESTError({status: 400, statusText: 'Bad Request'}, samples[0]).toString()).toEqual(
            'Error: 400 Bad Request (error code: 50035): Invalid Form Body\n' +
            "In $.activities.0.platform - BASE_TYPE_CHOICES(\"Value must be one of ('desktop', 'android', 'ios').\")\n" +
            'In $.activities.0.type - BASE_TYPE_CHOICES("Value must be one of (0, 1, 2, 3, 4, 5).")');
        
        expect(new RESTError({status: 400, statusText: 'Bad Request'}, samples[1]).toString()).toEqual(
            'Error: 400 Bad Request (error code: 50035): Invalid Form Body\n' +
            'In $.access_token - BASE_TYPE_REQUIRED("This field is required")');
        
        expect(new RESTError({status: 400, statusText: 'Bad Request'}, samples[2]).toString()).toEqual(
            'Error: 400 Bad Request (error code: 50035): Invalid Form Body\n' +
            'In $ - APPLICATION_COMMAND_TOO_LARGE("Command exceeds maximum size (8000)")');
    });
});

describe('REST', () => {
    test('does requests', async () => {
        let httpClient = new MockHTTPClient('basic');

        const rest1 = new REST({
            token: 'Bot AAAA.BBBB.CCCC',
            httpClient,
        });

        const response1 = await rest1.request(Endpoints.GET_GATEWAY());
        expect(response1.status).toBe(200);
        expect(response1.json()).resolves.toEqual({url: 'wss://gateway.discord.gg'});

        httpClient.state = 'foribdden';
        expect(rest1.request(Endpoints.MODIFY_GUILD('1'))).rejects.toThrow();
    });
});